"use client";

import { useEffect, useEffectEvent, useState } from "react";
import type { Map as MapLibreMap, MapMouseEvent } from "maplibre-gl";
import type { BrowserSupabase } from "@/lib/supabase/client";
import { ANCHOR_HIT_LAYER, removeAnchors, setAnchors } from "@/components/map/anchor-layers";
import { ANCHOR_COLUMNS, type Anchor } from "@/lib/anchor";
import type { LngLat } from "@/lib/geo";
import { useAutosave } from "./use-autosave";
import { useDragMarker } from "./use-drag-marker";

type Patch = Partial<Omit<Anchor, "id">>;

function anchorAt(map: MapLibreMap, point: { x: number; y: number }): string | null {
  if (!map.getLayer(ANCHOR_HIT_LAYER)) return null;
  const hit = map.queryRenderedFeatures([point.x, point.y], { layers: [ANCHOR_HIT_LAYER] });
  return (hit[0]?.properties?.id as string | undefined) ?? null;
}

export function AnchorPanel({
  map,
  supabase,
  eventId,
  anchors,
  onChange,
}: {
  map: MapLibreMap;
  supabase: BrowserSupabase;
  eventId: string;
  anchors: Anchor[];
  onChange: (update: (anchors: Anchor[]) => Anchor[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { pending, error, track, queue, cancel } = useAutosave<Patch>((id, patch) =>
    supabase.from("anchors").update(patch).eq("id", id),
  );

  const selected = anchors.find((a) => a.id === selectedId) ?? null;

  function update(id: string, patch: Patch, { immediate = false } = {}) {
    onChange((list) => list.map((a) => (a.id === id ? { ...a, ...patch } : a)));
    queue(id, patch, { immediate });
  }

  async function create([lng, lat]: LngLat) {
    const label = `Point ${anchors.length + 1}`;
    const result = await track(
      supabase.from("anchors").insert({ event_id: eventId, label, lng, lat }).select(ANCHOR_COLUMNS).single(),
    );
    if (!result?.data) return;
    const anchor = result.data;
    onChange((list) => [...list, anchor]);
    setSelectedId(anchor.id);
    setAdding(false);
  }

  async function remove(id: string) {
    if (!confirm("Supprimer ce QR code ? Les affiches déjà imprimées ne fonctionneront plus.")) return;
    cancel(id);
    const ok = await track(supabase.from("anchors").delete().eq("id", id));
    if (!ok) return;
    onChange((list) => list.filter((a) => a.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  // --- Carte ----------------------------------------------------------------

  useEffect(() => {
    setAnchors(map, anchors, selectedId);
  }, [map, anchors, selectedId]);
  useEffect(() => () => removeAnchors(map), [map]);

  const onClick = useEffectEvent((e: MapMouseEvent) => {
    if (adding) create([e.lngLat.lng, e.lngLat.lat]);
    else setSelectedId(anchorAt(map, e.point));
  });
  const onMove = useEffectEvent((e: MapMouseEvent) => {
    map.getCanvas().style.cursor = adding ? "crosshair" : anchorAt(map, e.point) ? "pointer" : "";
  });
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if ((e.target as HTMLElement).closest("input, textarea, select")) return;
    if (e.key === "Escape") {
      if (adding) setAdding(false);
      else setSelectedId(null);
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
    "size-10 cursor-grab rounded-full border-[3px] border-rose-600 bg-rose-600/10",
  );

  // --- Rendu ------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-lg bg-rose-50 p-3 text-sm text-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
        Chaque QR code imprimé indique au visiteur <strong>« Vous êtes ici »</strong>, même en intérieur où le GPS
        est imprécis. Placez-en aux entrées, aux croisements d&apos;allées et sur les piliers.
      </div>

      <div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setAdding(false)} className={adding ? "btn-secondary" : "btn-primary"}>
            Sélection
          </button>
          <button
            type="button"
            onClick={() => {
              setAdding(true);
              setSelectedId(null);
            }}
            className={adding ? "btn-primary" : "btn-secondary"}
          >
            + Placer un QR
          </button>
        </div>
        <p className="mt-2 text-sm text-zinc-500">
          {adding
            ? "Cliquez à l'endroit exact où l'affiche sera collée."
            : "Cliquez sur un point pour le renommer, glissez-le pour le déplacer."}
        </p>
      </div>

      {selected && (
        <div className="flex flex-col gap-3 rounded-lg border border-rose-200 bg-rose-50/50 p-3 dark:border-rose-900 dark:bg-rose-950/20">
          <div>
            <label htmlFor="anchor-label" className="label">
              Emplacement (imprimé sur l&apos;affiche)
            </label>
            <input
              id="anchor-label"
              value={selected.label}
              onChange={(e) => update(selected.id, { label: e.target.value })}
              onBlur={(e) => {
                if (!e.target.value.trim()) update(selected.id, { label: "Point" }, { immediate: true });
              }}
              placeholder="ex : Entrée Hall 1, Pilier C4"
              className="input"
            />
          </div>
          <button type="button" onClick={() => remove(selected.id)} className="btn-ghost justify-start px-0 text-red-600">
            Supprimer ce QR code
          </button>
        </div>
      )}

      <div className="flex flex-col gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <p className="label mb-0">QR codes ({anchors.length})</p>
          <span className="text-xs text-zinc-500">{pending > 0 ? "Enregistrement…" : error ? "" : "Enregistrés automatiquement"}</span>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <ul className="flex flex-col">
          {anchors.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => {
                  setSelectedId(a.id);
                  map.easeTo({ center: [a.lng, a.lat], zoom: Math.max(map.getZoom(), 18) });
                }}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                  a.id === selectedId ? "bg-rose-50 dark:bg-rose-950/40" : ""
                }`}
              >
                <span className="size-2.5 shrink-0 rounded-full bg-rose-600" />
                <span className="flex-1 truncate">{a.label}</span>
              </button>
            </li>
          ))}
        </ul>
        {anchors.length === 0 && <p className="text-sm text-zinc-500">Aucun QR code placé.</p>}
        <a
          href={`/dashboard/events/${eventId}/qr`}
          target="_blank"
          rel="noreferrer"
          className="btn-secondary mt-2"
        >
          Imprimer les affiches ↗
        </a>
      </div>
    </div>
  );
}
