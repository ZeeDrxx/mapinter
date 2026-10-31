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
import { ErrorText, Hint, Section, Selection } from "./panel-ui";
import { Pictogram } from "@/components/ui/pictogram";
import { StatusMark } from "@/components/ui/status";

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
    "size-10 cursor-grab rounded-sign border-2 border-dashed border-signal",
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
    <div className="flex flex-col gap-7">
      <Section title="Mode">
        <div className="segmented" role="radiogroup" aria-label="Mode">
          <button type="button" role="radio" aria-checked={!adding} onClick={() => setAdding(false)}>
            Sélection
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={adding}
           
            onClick={() => {
              setAdding(true);
              onSelect(null);
            }}
          >
            + Ajouter un lieu
          </button>
        </div>
        <Hint>
          {adding
            ? "Cliquez sur la carte pour placer le lieu. Échap pour arrêter."
            : "Cliquez sur un lieu pour le modifier, glissez son marqueur pour le déplacer."}
        </Hint>
        {adding && (
          <div>
            <p className="field-label">Type de lieu</p>
            <CategoryPicker value={addCategory} onChange={setAddCategory} />
          </div>
        )}
      </Section>

      {candidates.length > 0 && (
        <section className="flex items-center gap-3 rounded-sign bg-ink p-3.5 text-on-ink">
          <p className="min-w-0 flex-1 text-[13px] leading-snug">
            {candidates.length > 1 ? (
              <>
                <strong className="num font-mono">{candidates.length}</strong> stands ou scènes du dessin n&apos;ont pas
                encore de fiche.
              </>
            ) : (
              <>
                <strong className="num font-mono">1</strong> stand ou scène du dessin n&apos;a pas encore de fiche.
              </>
            )}
          </p>
          <button type="button" onClick={generateFromPlan} disabled={pending > 0} className="btn btn-signal btn-sm shrink-0">
            Créer les fiches
          </button>
        </section>
      )}

      {selected && (
        <SelectedPoi
          key={selected.id}
          poi={selected}
          onUpdate={(patch, immediate) => update(selected.id, patch, { immediate })}
          onDelete={() => remove(selected.id)}
        />
      )}

      <Section title={`Lieux · ${pois.length}`} aside={pending > 0 ? "Enregistrement…" : error ? undefined : "Enregistrés automatiquement"}>
        {error && <ErrorText>{error}</ErrorText>}
        {pois.length > 0 && (
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un lieu, un numéro…"
            aria-label="Rechercher un lieu"
            className="input"
          />
        )}
        <ul className="-mx-2 flex flex-col">
          {list.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => focus(p)}
                aria-current={p.id === selectedId}
                className={`flex w-full items-center gap-2.5 rounded-sign px-2 py-1.5 text-left text-[13.5px] transition-colors hover:bg-paper-2 ${
                  p.id === selectedId ? "bg-paper-2" : ""
                }`}
              >
                <Pictogram category={p.category} size={20} tone={p.id === selectedId ? "signal" : "ink"} />
                <span className="min-w-0 flex-1 truncate">
                  {p.code && p.code !== p.name && <span className="mr-1.5 font-mono text-[12px] font-semibold text-t3">{p.code}</span>}
                  {p.name}
                </span>
                {p.status !== "open" && <StatusMark status={p.status} className="text-[11.5px]" />}
              </button>
            </li>
          ))}
        </ul>
        {pois.length === 0 && (
          <p className="fine">Aucun lieu pour l&apos;instant. Ajoutez-en sur la carte ou créez-les depuis les stands dessinés.</p>
        )}
      </Section>
    </div>
  );
}

/** Choix de catégorie par pictogramme, comme sur un panneau. */
function CategoryPicker({ value, onChange }: { value: PoiCategory; onChange: (c: PoiCategory) => void }) {
  return (
    <div className="grid grid-cols-5 gap-1" role="radiogroup" aria-label="Type de lieu">
      {POI_CATEGORY_IDS.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          title={POI_CATEGORIES[c].label}
          onClick={() => onChange(c)}
          className={`flex flex-col items-center gap-1 rounded-sign px-1 pt-2 pb-1.5 text-[10.5px] leading-tight font-semibold transition-colors ${
            value === c ? "bg-ink text-on-ink" : "bg-paper-2 text-t2 hover:bg-paper-3"
          }`}
        >
          <Pictogram category={c} size={22} tone={value === c ? "signal" : "ink"} />
          <span className="w-full truncate text-center">{POI_CATEGORIES[c].label.split(" ")[0]}</span>
        </button>
      ))}
    </div>
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
    <Selection title="Lieu sélectionné" aside={POI_CATEGORIES[poi.category].label}>
      <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-2">
        <div>
          <label htmlFor="poi-name" className="field-label">
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
          <label htmlFor="poi-code" className="field-label">
            Numéro
          </label>
          <input
            id="poi-code"
            value={poi.code ?? ""}
            onChange={(e) => onUpdate({ code: e.target.value || null })}
            placeholder="B12"
            className="input font-mono"
          />
        </div>
      </div>
      <div>
        <p className="field-label">Type</p>
        <CategoryPicker value={poi.category} onChange={(category) => onUpdate({ category }, true)} />
      </div>
      <div>
        <label htmlFor="poi-description" className="field-label">
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
        <p className="field-label">État · visible en direct</p>
        <div className="segmented" role="radiogroup" aria-label="État">
          {(Object.keys(POI_STATUSES) as PoiStatus[]).map((s) => (
            <button key={s} type="button" role="radio" aria-checked={poi.status === s} onClick={() => onUpdate({ status: s }, true)}>
              <StatusMark status={s} className="text-[12px]" />
            </button>
          ))}
        </div>
      </div>
      <button type="button" onClick={onDelete} className="btn btn-ghost btn-sm -ml-3 self-start">
        Supprimer le lieu
      </button>
    </Selection>
  );
}
