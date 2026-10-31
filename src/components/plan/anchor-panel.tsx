"use client";

import { useEffect, useEffectEvent, useState } from "react";
import type { Map as MapLibreMap, MapMouseEvent } from "maplibre-gl";
import type { BrowserSupabase } from "@/lib/supabase/client";
import { ANCHOR_HIT_LAYER, removeAnchors, setAnchors } from "@/components/map/anchor-layers";
import { ANCHOR_COLUMNS, type Anchor } from "@/lib/anchor";
import type { LngLat } from "@/lib/geo";
import { useAutosave } from "./use-autosave";
import { useDragMarker } from "./use-drag-marker";
import { ErrorText, Hint, Section, Selection } from "./panel-ui";

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
    "size-10 cursor-grab rounded-full border-2 border-dashed border-signal",
  );

  // --- Rendu ------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-7">
      <Hint>
        Chaque affiche indique au visiteur <strong className="font-semibold text-t1">« Vous êtes ici »</strong>, même en
        intérieur où le GPS est imprécis. Placez-en aux entrées, aux croisements d&apos;allées et sur les piliers.
      </Hint>

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
              setSelectedId(null);
            }}
          >
            + Placer un QR
          </button>
        </div>
        <p className="fine">
          {adding
            ? "Cliquez à l'endroit exact où l'affiche sera collée."
            : "Cliquez sur un point pour le renommer, glissez-le pour le déplacer."}
        </p>
      </Section>

      {selected && (
        <Selection title="QR code sélectionné">
          <div>
            <label htmlFor="anchor-label" className="field-label">
              Emplacement · imprimé sur l&apos;affiche
            </label>
            <input
              id="anchor-label"
              value={selected.label}
              onChange={(e) => update(selected.id, { label: e.target.value })}
              onBlur={(e) => {
                if (!e.target.value.trim()) update(selected.id, { label: "Point" }, { immediate: true });
              }}
              placeholder="Entrée Hall 1, Pilier C4…"
              className="input"
            />
          </div>
          <button type="button" onClick={() => remove(selected.id)} className="btn btn-ghost btn-sm -ml-3 self-start">
            Supprimer ce QR code
          </button>
        </Selection>
      )}

      <Section
        title={`QR codes · ${anchors.length}`}
        aside={pending > 0 ? "Enregistrement…" : error ? undefined : "Enregistrés automatiquement"}
      >
        {error && <ErrorText>{error}</ErrorText>}
        <ul className="-mx-2 flex flex-col">
          {anchors.map((a, i) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => {
                  setSelectedId(a.id);
                  map.easeTo({ center: [a.lng, a.lat], zoom: Math.max(map.getZoom(), 18) });
                }}
                aria-current={a.id === selectedId}
                className={`flex w-full items-center gap-2.5 rounded-sign px-2 py-1.5 text-left text-[13.5px] transition-colors hover:bg-paper-2 ${
                  a.id === selectedId ? "bg-paper-2" : ""
                }`}
              >
                <span className="num grid size-5 shrink-0 place-items-center rounded-full bg-signal font-mono text-[10px] font-semibold text-on-signal">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate">{a.label}</span>
              </button>
            </li>
          ))}
        </ul>
        {anchors.length === 0 && <p className="fine">Aucun QR code placé.</p>}
        <a href={`/dashboard/events/${eventId}/qr`} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm self-start">
          Imprimer les affiches ↗
        </a>
      </Section>
    </div>
  );
}
