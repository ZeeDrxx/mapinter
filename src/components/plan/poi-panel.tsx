"use client";

import { useEffect, useEffectEvent, useState } from "react";
import type { Map as MapLibreMap, MapMouseEvent } from "maplibre-gl";
import type { BrowserSupabase } from "@/lib/supabase/client";
import { poiAt } from "@/components/map/poi-layers";
import { PLAN_FILL } from "@/components/map/plan-layers";
import {
  POI_CATEGORIES,
  POI_CATEGORY_IDS,
  POI_COLUMNS,
  POI_STATUSES,
  poiTitle,
  rowToPoi,
  searchPois,
  type Poi,
  type PoiCategory,
  type PoiStatus,
} from "@/lib/poi";
import { ringCentroid, type PlanCollection } from "@/lib/plan";
import type { LngLat } from "@/lib/geo";
import { useAutosave } from "./use-autosave";
import { useDragMarker } from "./use-drag-marker";

type Patch = Partial<Omit<Poi, "id">>;

function toRow(patch: Patch) {
  const { featureId, ...rest } = patch;
  return featureId === undefined ? rest : { ...rest, metadata: { featureId } };
}

function defaultName(category: PoiCategory) {
  return POI_CATEGORIES[category].label;
}

export function PoiPanel({
  map,
  supabase,
  eventId,
  plan,
  pois,
  onChange,
  selectedId,
  onSelect,
}: {
  map: MapLibreMap;
  supabase: BrowserSupabase;
  eventId: string;
  plan: PlanCollection;
  pois: Poi[];
  onChange: (update: (pois: Poi[]) => Poi[]) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [addCategory, setAddCategory] = useState<PoiCategory>("stand");
  const [query, setQuery] = useState("");
  const { pending, error, track, queue, cancel } = useAutosave<Patch>((id, patch) =>
    supabase.from("pois").update(toRow(patch)).eq("id", id),
  );

  const selected = pois.find((p) => p.id === selectedId) ?? null;

  // --- Persistance ----------------------------------------------------------

  function update(id: string, patch: Patch, { immediate = false } = {}) {
    onChange((list) => list.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    queue(id, patch, { immediate });
  }

  async function create(position: LngLat) {
    const result = await track(
      supabase
        .from("pois")
        .insert({ event_id: eventId, category: addCategory, name: defaultName(addCategory), lng: position[0], lat: position[1] })
        .select(POI_COLUMNS)
        .single(),
    );
    if (!result?.data) return;
    const poi = rowToPoi(result.data);
    onChange((list) => [...list, poi]);
    onSelect(poi.id);
  }

  async function remove(id: string) {
    cancel(id);
    const ok = await track(supabase.from("pois").delete().eq("id", id));
    if (!ok) return;
    onChange((list) => list.filter((p) => p.id !== id));
    if (selectedId === id) onSelect(null);
  }

  // Stands et scènes dessinés qui n'ont pas encore de lieu associé
  const linked = new Set(pois.map((p) => p.featureId).filter(Boolean));
  const candidates = plan.features.filter(
    (f) =>
      f.geometry.type === "Polygon" &&
      (f.properties.kind === "stand" || f.properties.kind === "stage") &&
      !linked.has(f.properties.id),
  );

  async function generateFromPlan() {
    const rows = candidates.map((f) => {
      const ring = (f.geometry.coordinates as LngLat[][])[0].slice(0, -1);
      const [lng, lat] = ringCentroid(ring);
      const label = f.properties.label.trim();
      const isStand = f.properties.kind === "stand";
      return {
        event_id: eventId,
        category: isStand ? "stand" : "stage",
        name: isStand ? (label ? `Stand ${label}` : "Stand") : label || "Scène",
        code: isStand && label ? label : null,
        lng,
        lat,
        metadata: { featureId: f.properties.id },
      };
    });
    // defaultToNull: false → les colonnes absentes prennent leur valeur par défaut (status, metadata…)
    const result = await track(supabase.from("pois").insert(rows, { defaultToNull: false }).select(POI_COLUMNS));
    if (result?.data) {
      const created = result.data.map(rowToPoi);
      onChange((list) => [...list, ...created]);
    }
  }

  // --- Carte ----------------------------------------------------------------

  const onClick = useEffectEvent((e: MapMouseEvent) => {
    if (adding) {
      create([e.lngLat.lng, e.lngLat.lat]);
      return;
    }
    const hit = poiAt(map, e.point);
    if (hit) {
      onSelect(hit);
      return;
    }
    // Un clic sur un stand dessiné sélectionne le lieu qui en est issu
    if (map.getLayer(PLAN_FILL)) {
      const featureId = map.queryRenderedFeatures(e.point, { layers: [PLAN_FILL] })[0]?.properties?.id;
      const poi = featureId && pois.find((p) => p.featureId === featureId);
      if (poi) {
        onSelect(poi.id);
        return;
      }
    }
    onSelect(null);
  });

  const onMove = useEffectEvent((e: MapMouseEvent) => {
    map.getCanvas().style.cursor = adding ? "crosshair" : poiAt(map, e.point) ? "pointer" : "";
  });

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if ((e.target as HTMLElement).closest("input, textarea, select")) return;
    if (e.key === "Escape") {
      if (adding) setAdding(false);
      else onSelect(null);
    } else if ((e.key === "Delete" || e.key === "Backspace") && selected) {
      e.preventDefault();
      remove(selected.id);
    }
  });

  useEffect(() => {
    map.on("click", onClick);
    map.on("mousemove", onMove);
    window.addEventListener("keydown", onKey);
    return () => {
      map.off("click", onClick);
      map.off("mousemove", onMove);
      window.removeEventListener("keydown", onKey);
      map.getCanvas().style.cursor = "";
    };
  }, [map]);

  useDragMarker(
    map,
    selected,
    (id, [lng, lat]) => update(id, { lng, lat }, { immediate: true }),
    "size-9 cursor-grab rounded-full border-[3px] border-blue-600 bg-blue-600/10",
  );

  function focus(poi: Poi) {
    onSelect(poi.id);
    map.easeTo({ center: [poi.lng, poi.lat], zoom: Math.max(map.getZoom(), 18) });
  }

  // --- Rendu ------------------------------------------------------------------

  const list = query.trim()
    ? searchPois(pois, query, 50)
    : [...pois].sort((a, b) => poiTitle(a).localeCompare(poiTitle(b), "fr", { numeric: true }));

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setAdding(false)} className={adding ? "btn-secondary" : "btn-primary"}>
            Sélection
          </button>
          <button
            type="button"
            onClick={() => {
              setAdding(true);
              onSelect(null);
            }}
            className={adding ? "btn-primary" : "btn-secondary"}
          >
            + Ajouter un lieu
          </button>
        </div>
        <p className="mt-2 text-sm text-zinc-500">
          {adding
            ? "Cliquez sur la carte pour placer le lieu. Échap pour arrêter."
            : "Cliquez sur un lieu pour le modifier, glissez son marqueur pour le déplacer."}
        </p>
      </div>

      {adding && (
        <div>
          <label htmlFor="add-category" className="label">
            Type de lieu
          </label>
          <CategorySelect id="add-category" value={addCategory} onChange={setAddCategory} />
        </div>
      )}

      {candidates.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/30">
          <p className="text-amber-900 dark:text-amber-200">
            {candidates.length} stand(s) ou scène(s) du dessin n&apos;ont pas encore de lieu.
          </p>
          <button type="button" onClick={generateFromPlan} disabled={pending > 0} className="btn-secondary mt-2 w-full">
            Créer les lieux depuis le dessin
          </button>
        </div>
      )}

      {selected && (
        <SelectedPoi
          key={selected.id}
          poi={selected}
          onUpdate={(patch, immediate) => update(selected.id, patch, { immediate })}
          onDelete={() => remove(selected.id)}
        />
      )}

      <div className="flex flex-col gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <p className="label mb-0">Lieux ({pois.length})</p>
          <span className="text-xs text-zinc-500">
            {pending > 0 ? "Enregistrement…" : error ? "" : "Enregistrés automatiquement"}
          </span>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {pois.length > 0 && (
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un lieu, un numéro…"
            className="input"
          />
        )}
        <ul className="flex flex-col">
          {list.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => focus(p)}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                  p.id === selectedId ? "bg-blue-50 dark:bg-blue-950/40" : ""
                }`}
              >
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: POI_CATEGORIES[p.category].color }} />
                <span className="flex-1 truncate">{poiTitle(p)}</span>
                {p.status !== "open" && <span className="text-xs text-zinc-500">{POI_STATUSES[p.status].label}</span>}
              </button>
            </li>
          ))}
        </ul>
        {pois.length === 0 && (
          <p className="text-sm text-zinc-500">
            Aucun lieu pour l&apos;instant. Ajoutez-en sur la carte ou générez-les depuis les stands dessinés.
          </p>
        )}
      </div>
    </div>
  );
}

function CategorySelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: PoiCategory;
  onChange: (c: PoiCategory) => void;
}) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value as PoiCategory)} className="input">
      {POI_CATEGORY_IDS.map((c) => (
        <option key={c} value={c}>
          {POI_CATEGORIES[c].label}
        </option>
      ))}
    </select>
  );
}

function SelectedPoi({
  poi,
  onUpdate,
  onDelete,
}: {
  poi: Poi;
  onUpdate: (patch: Patch, immediate?: boolean) => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-900 dark:bg-blue-950/20">
      <p className="text-sm font-semibold">Lieu sélectionné</p>
      <div className="grid grid-cols-[1fr_6rem] gap-2">
        <div>
          <label htmlFor="poi-category" className="label">
            Type
          </label>
          <CategorySelect id="poi-category" value={poi.category} onChange={(category) => onUpdate({ category }, true)} />
        </div>
        <div>
          <label htmlFor="poi-code" className="label">
            Numéro
          </label>
          <input
            id="poi-code"
            value={poi.code ?? ""}
            onChange={(e) => onUpdate({ code: e.target.value || null })}
            placeholder="B12"
            className="input"
          />
        </div>
      </div>
      <div>
        <label htmlFor="poi-name" className="label">
          Nom
        </label>
        <input
          id="poi-name"
          value={poi.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          onBlur={(e) => {
            if (!e.target.value.trim()) onUpdate({ name: POI_CATEGORIES[poi.category].label }, true);
          }}
          className="input"
        />
      </div>
      <div>
        <label htmlFor="poi-description" className="label">
          Description
        </label>
        <textarea
          id="poi-description"
          rows={3}
          value={poi.description ?? ""}
          onChange={(e) => onUpdate({ description: e.target.value || null })}
          placeholder="Exposant, horaires, programme…"
          className="input"
        />
      </div>
      <div>
        <p className="label">État</p>
        <div className="grid grid-cols-3 gap-1">
          {(Object.keys(POI_STATUSES) as PoiStatus[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onUpdate({ status: s }, true)}
              className={`rounded-md border px-2 py-1 text-xs font-medium ${
                poi.status === s
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900"
              }`}
            >
              {POI_STATUSES[s].label}
            </button>
          ))}
        </div>
      </div>
      <button type="button" onClick={onDelete} className="btn-ghost justify-start px-0 text-red-600">
        Supprimer le lieu
      </button>
    </div>
  );
}
