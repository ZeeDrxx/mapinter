"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { MapMouseEvent, MapTouchEvent } from "maplibre-gl";
import { useMapLibre } from "./use-maplibre";
import { fitZone, setZone } from "./zone-layer";
import { bboxFromCorners, bboxSizeMeters, formatMeters, type BBox, type LngLat } from "@/lib/geo";

type SearchResult = {
  place_id: number;
  display_name: string;
  boundingbox: [string, string, string, string]; // [sud, nord, ouest, est]
};

const MIN_SIDE_METERS = 5;

export function ZonePicker({
  value,
  onChange,
}: {
  value: BBox | null;
  onChange: (bbox: BBox) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const map = useMapLibre(containerRef, { center: [2.3488, 48.8534], zoom: 11 });
  const [drawing, setDrawing] = useState(false);

  const emitChange = useEffectEvent((bbox: BBox) => onChange(bbox));

  // Affiche la zone validée (et restaure-la si un tracé est annulé)
  useEffect(() => {
    if (map && !drawing) setZone(map, value);
  }, [map, drawing, value]);

  // Mode dessin : cliquer-glisser pour tracer le rectangle
  useEffect(() => {
    if (!map || !drawing) return;

    const canvas = map.getCanvasContainer();
    canvas.style.cursor = "crosshair";
    map.dragPan.disable();
    map.boxZoom.disable();
    map.doubleClickZoom.disable();
    map.touchZoomRotate.disable();

    let start: LngLat | null = null;
    let current: LngLat | null = null;

    const onDown = (e: MapMouseEvent | MapTouchEvent) => {
      if ("points" in e && e.points.length > 1) return;
      e.preventDefault();
      start = current = [e.lngLat.lng, e.lngLat.lat];
    };
    const onMove = (e: MapMouseEvent | MapTouchEvent) => {
      if (!start) return;
      current = [e.lngLat.lng, e.lngLat.lat];
      setZone(map, bboxFromCorners(start, current));
    };
    const onUp = () => {
      if (!start || !current) return;
      const bbox = bboxFromCorners(start, current);
      start = current = null;
      const { width, height } = bboxSizeMeters(bbox);
      if (width < MIN_SIDE_METERS || height < MIN_SIDE_METERS) return;
      emitChange(bbox);
      setDrawing(false);
    };

    map.on("mousedown", onDown);
    map.on("touchstart", onDown);
    map.on("mousemove", onMove);
    map.on("touchmove", onMove);
    map.on("mouseup", onUp);
    map.on("touchend", onUp);

    return () => {
      map.off("mousedown", onDown);
      map.off("touchstart", onDown);
      map.off("mousemove", onMove);
      map.off("touchmove", onMove);
      map.off("mouseup", onUp);
      map.off("touchend", onUp);
      canvas.style.cursor = "";
      map.dragPan.enable();
      map.boxZoom.enable();
      map.doubleClickZoom.enable();
      map.touchZoomRotate.enable();
    };
  }, [map, drawing]);

  // Échap annule le dessin
  useEffect(() => {
    if (!drawing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawing(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawing]);

  function applyCurrentView() {
    if (!map) return;
    const b = map.getBounds();
    onChange([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
  }

  const size = value ? bboxSizeMeters(value) : null;

  return (
    <div className="flex flex-col gap-3">
      <PlaceSearch
        onSelect={(bbox) => {
          if (map) fitZone(map, bbox);
        }}
      />

      <div className="relative h-[460px] overflow-hidden rounded-sign bg-paper-2">
        <div ref={containerRef} className="map-fill absolute inset-0" />
        {!map && (
          <div className="absolute inset-0 grid place-items-center">
            <p className="label">Chargement de la carte…</p>
          </div>
        )}
        {drawing && (
          <p className="pointer-events-none absolute inset-x-0 top-3 mx-auto w-fit rounded-sign bg-ink px-3.5 py-2 text-[13px] font-medium text-on-ink shadow-lift">
            Cliquez-glissez pour tracer la zone · Échap pour annuler
          </p>
        )}
        {size && !drawing && (
          <p className="num absolute bottom-3 left-3 rounded-sign bg-sheet px-2.5 py-1.5 font-mono text-[12px] font-semibold shadow-sheet">
            {formatMeters(size.width)} × {formatMeters(size.height)}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setDrawing((d) => !d)}
          disabled={!map}
          className={`btn ${drawing ? "btn-secondary" : "btn-primary"}`}
        >
          {drawing ? "Annuler le tracé" : value ? "Redessiner la zone" : "Dessiner la zone"}
        </button>
        <button type="button" onClick={applyCurrentView} disabled={!map || drawing} className="btn btn-secondary">
          Utiliser la vue actuelle
        </button>
        {value && map && !drawing && (
          <button type="button" onClick={() => fitZone(map, value)} className="btn btn-ghost">
            Recentrer
          </button>
        )}
        {!value && <p className="fine ml-auto">Aucune zone définie</p>}
      </div>
    </div>
  );
}

function PlaceSearch({ onSelect }: { onSelect: (bbox: BBox) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "empty" | "error">("idle");

  async function search() {
    const q = query.trim();
    if (q.length < 3) return;
    setStatus("loading");
    try {
      const url = new URL("https://nominatim.openstreetmap.org/search");
      url.search = new URLSearchParams({ q, format: "jsonv2", limit: "5" }).toString();
      const res = await fetch(url, { headers: { "Accept-Language": "fr" } });
      if (!res.ok) throw new Error(String(res.status));
      const data: SearchResult[] = await res.json();
      setResults(data);
      setStatus(data.length ? "idle" : "empty");
    } catch {
      setStatus("error");
    }
  }

  function select(r: SearchResult) {
    const [s, n, w, e] = r.boundingbox.map(Number);
    onSelect([w, s, e, n]);
    setResults([]);
    setQuery(r.display_name);
  }

  return (
    <div className="relative">
      <div className="flex gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              search();
            }
          }}
          placeholder="Le lieu de l'event (ex : Paris Expo Porte de Versailles)"
          aria-label="Rechercher le lieu"
          className="input flex-1"
        />
        <button type="button" onClick={search} className="btn btn-secondary" disabled={status === "loading"}>
          {status === "loading" ? "Recherche…" : "Rechercher"}
        </button>
      </div>
      {status === "empty" && <p className="fine mt-1.5">Aucun résultat.</p>}
      {status === "error" && <p className="mt-1.5 text-[13px] font-semibold text-busy">La recherche a échoué, réessayez.</p>}
      {results.length > 0 && (
        <ul className="sheet-lift rise absolute z-10 mt-1.5 w-full overflow-hidden py-1">
          {results.map((r) => (
            <li key={r.place_id}>
              <button
                type="button"
                onClick={() => select(r)}
                className="w-full px-3.5 py-2.5 text-left text-[13.5px] transition-colors hover:bg-paper-2"
              >
                {r.display_name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
