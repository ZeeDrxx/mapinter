"use client";

import { useEffect, useEffectEvent, useState } from "react";
import type { GeoJSONSource, Map as MapLibreMap, MapMouseEvent } from "maplibre-gl";
import type { Feature, FeatureCollection } from "geojson";
import { PLAN_HIT_LAYERS } from "@/components/map/plan-layers";
import type { OsmBuilding } from "@/lib/osm";
import { newId } from "@/lib/id";
import { formatMeters, type BBox, type LngLat } from "@/lib/geo";
import {
  AREA_KINDS,
  PLAN_KINDS,
  gridFrom3,
  lineLength,
  pathFeature,
  polygonFeature,
  rectFrom3,
  ringArea,
  type AreaKind,
  type PlanCollection,
  type PlanFeature,
  type PlanKind,
} from "@/lib/plan";

type Tool = "select" | "rect" | "polygon" | "path" | "grid";

const TOOLS: { id: Tool; label: string; help: string }[] = [
  { id: "select", label: "Sélection", help: "Cliquez sur un élément pour le modifier. Suppr pour l'effacer." },
  { id: "rect", label: "Rectangle", help: "Cliquez 2 points pour un côté, puis un 3e pour la largeur." },
  {
    id: "polygon",
    label: "Polygone",
    help: "Cliquez chaque sommet. Double-clic, Entrée ou clic sur le 1er point pour terminer.",
  },
  { id: "path", label: "Chemin", help: "Cliquez chaque point du chemin. Double-clic ou Entrée pour terminer." },
  {
    id: "grid",
    label: "Grille de stands",
    help: "Cliquez 2 points le long de la rangée, puis un 3e pour la profondeur.",
  },
];

type GridOptions = { rows: number; cols: number; prefix: string; start: number };

// ---------------------------------------------------------------------------
// Aperçu du tracé en cours
// ---------------------------------------------------------------------------

const DRAFT_SOURCE = "plan-draft";

function setDraft(map: MapLibreMap, features: Feature[]) {
  const data: FeatureCollection = { type: "FeatureCollection", features };
  const source = map.getSource<GeoJSONSource>(DRAFT_SOURCE);
  if (source) {
    source.setData(data);
    return;
  }
  map.addSource(DRAFT_SOURCE, { type: "geojson", data });
  map.addLayer({
    id: `${DRAFT_SOURCE}-fill`,
    type: "fill",
    source: DRAFT_SOURCE,
    filter: ["==", ["geometry-type"], "Polygon"],
    paint: { "fill-color": "#2563eb", "fill-opacity": 0.15 },
  });
  map.addLayer({
    id: `${DRAFT_SOURCE}-line`,
    type: "line",
    source: DRAFT_SOURCE,
    filter: ["!=", ["geometry-type"], "Point"],
    paint: { "line-color": "#2563eb", "line-width": 2, "line-dasharray": [2, 1] },
  });
  map.addLayer({
    id: `${DRAFT_SOURCE}-points`,
    type: "circle",
    source: DRAFT_SOURCE,
    filter: ["==", ["geometry-type"], "Point"],
    paint: { "circle-radius": 4, "circle-color": "#ffffff", "circle-stroke-color": "#2563eb", "circle-stroke-width": 2 },
  });
}

function removeDraft(map: MapLibreMap) {
  for (const id of ["fill", "line", "points"]) {
    if (map.getLayer(`${DRAFT_SOURCE}-${id}`)) map.removeLayer(`${DRAFT_SOURCE}-${id}`);
  }
  if (map.getSource(DRAFT_SOURCE)) map.removeSource(DRAFT_SOURCE);
}

const point = (p: LngLat): Feature => ({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: p } });
const line = (pts: LngLat[]): Feature => ({
  type: "Feature",
  properties: {},
  geometry: { type: "LineString", coordinates: pts },
});
const polygon = (ring: LngLat[]): Feature => ({
  type: "Feature",
  properties: {},
  geometry: { type: "Polygon", coordinates: [[...ring, ring[0]]] },
});

function draftFeatures(tool: Tool, points: LngLat[], hover: LngLat | null, grid: GridOptions): Feature[] {
  const pts = hover ? [...points, hover] : points;
  const shapes: Feature[] = [];
  if (tool === "rect" || tool === "grid") {
    if (pts.length === 2) shapes.push(line(pts));
    if (pts.length === 3) {
      if (tool === "rect") shapes.push(polygon(rectFrom3(pts[0], pts[1], pts[2])));
      else gridFrom3(pts[0], pts[1], pts[2], grid.rows, grid.cols).forEach((c) => shapes.push(polygon(c)));
    }
  } else if (tool === "polygon") {
    if (pts.length >= 3) shapes.push(polygon(pts));
    else if (pts.length === 2) shapes.push(line(pts));
  } else if (tool === "path" && pts.length >= 2) {
    shapes.push(line(pts));
  }
  return [...shapes, ...points.map(point)];
}

// ---------------------------------------------------------------------------

export function DrawPanel({
  map,
  bbox,
  plan,
  onChange,
  onUndo,
  canUndo,
  selectedId,
  onSelect,
}: {
  map: MapLibreMap;
  bbox: BBox;
  plan: PlanCollection;
  onChange: (plan: PlanCollection) => void;
  onUndo: () => void;
  canUndo: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [tool, setTool] = useState<Tool>("select");
  const [areaKind, setAreaKind] = useState<AreaKind>("hall");
  const [grid, setGrid] = useState<GridOptions>({ rows: 2, cols: 8, prefix: "A", start: 1 });
  const [points, setPoints] = useState<LngLat[]>([]);
  const [hover, setHover] = useState<LngLat | null>(null);
  const [osmState, setOsmState] = useState<{ status: "idle" | "loading" | "done" | "error"; message?: string }>({
    status: "idle",
  });

  const selected = plan.features.find((f) => f.properties.id === selectedId) ?? null;

  function chooseTool(next: Tool) {
    setTool(next);
    setPoints([]);
    setHover(null);
    if (next !== "select") onSelect(null);
  }

  // --- Modifications du plan ---------------------------------------------

  function addFeatures(features: PlanFeature[]) {
    onChange({ ...plan, features: [...plan.features, ...features] });
  }

  function updateSelected(patch: Partial<PlanFeature["properties"]>) {
    if (!selected) return;
    onChange({
      ...plan,
      features: plan.features.map((f) =>
        f === selected ? { ...f, properties: { ...f.properties, ...patch } } : f,
      ),
    });
  }

  function deleteSelected() {
    if (!selected) return;
    onChange({ ...plan, features: plan.features.filter((f) => f !== selected) });
    onSelect(null);
  }

  function finish(pts: LngLat[]) {
    setPoints([]);
    setHover(null);
    if (tool === "rect" && pts.length === 3) {
      const f = polygonFeature(newId(), rectFrom3(pts[0], pts[1], pts[2]), areaKind);
      addFeatures([f]);
      onSelect(f.properties.id);
    } else if (tool === "grid" && pts.length === 3) {
      const cells = gridFrom3(pts[0], pts[1], pts[2], grid.rows, grid.cols);
      addFeatures(cells.map((ring, i) => polygonFeature(newId(), ring, "stand", `${grid.prefix}${grid.start + i}`)));
      setGrid((g) => ({ ...g, start: g.start + cells.length }));
    } else if (tool === "polygon" && pts.length >= 3) {
      const f = polygonFeature(newId(), pts, areaKind);
      addFeatures([f]);
      onSelect(f.properties.id);
    } else if (tool === "path" && pts.length >= 2) {
      const f = pathFeature(newId(), pts);
      addFeatures([f]);
      onSelect(f.properties.id);
    }
  }

  /** Retire les points confondus à l'écran (le double-clic en ajoute deux). */
  function dedupe(pts: LngLat[]): LngLat[] {
    return pts.filter((p, i) => {
      if (i === 0) return true;
      const a = map.project(pts[i - 1]);
      const b = map.project(p);
      return Math.hypot(a.x - b.x, a.y - b.y) > 4;
    });
  }

  async function importOsm() {
    setOsmState({ status: "loading" });
    try {
      const res = await fetch(`/api/osm/buildings?bbox=${bbox.join(",")}`);
      if (!res.ok) throw new Error(String(res.status));
      const { buildings }: { buildings: OsmBuilding[] } = await res.json();
      const known = new Set(plan.features.map((f) => f.properties.osmId).filter(Boolean));
      const fresh = buildings
        .filter((b) => !known.has(b.osmId))
        .map((b) => {
          const f = polygonFeature(newId(), b.ring, "hall", b.name);
          f.properties.osmId = b.osmId;
          return f;
        });
      if (fresh.length) addFeatures(fresh);
      setOsmState({
        status: "done",
        message: buildings.length
          ? `${fresh.length} bâtiment(s) ajouté(s)${fresh.length < buildings.length ? " (les autres étaient déjà importés)" : ""}.`
          : "Aucun bâtiment trouvé dans la zone.",
      });
    } catch {
      setOsmState({ status: "error", message: "OpenStreetMap ne répond pas, réessayez dans un instant." });
    }
  }

  // --- Interactions carte -------------------------------------------------

  const onClick = useEffectEvent((e: MapMouseEvent) => {
    const p: LngLat = [e.lngLat.lng, e.lngLat.lat];
    if (tool === "select") {
      const layers = PLAN_HIT_LAYERS.filter((id) => map.getLayer(id));
      const hit = map.queryRenderedFeatures(e.point, { layers });
      onSelect((hit[0]?.properties?.id as string | undefined) ?? null);
      return;
    }
    if (tool === "rect" || tool === "grid") {
      const next = [...points, p];
      if (next.length === 3) finish(next);
      else setPoints(next);
      return;
    }
    if (tool === "polygon" && points.length >= 3) {
      const first = map.project(points[0]);
      if (Math.hypot(first.x - e.point.x, first.y - e.point.y) < 10) {
        finish(points);
        return;
      }
    }
    setPoints([...points, p]);
  });

  const onDblClick = useEffectEvent((e: MapMouseEvent) => {
    if (tool !== "polygon" && tool !== "path") return;
    e.preventDefault();
    finish(dedupe(points));
  });

  const onMove = useEffectEvent((e: MapMouseEvent) => {
    if (tool === "select") {
      const layers = PLAN_HIT_LAYERS.filter((id) => map.getLayer(id));
      const hit = layers.length > 0 && map.queryRenderedFeatures(e.point, { layers }).length > 0;
      map.getCanvas().style.cursor = hit ? "pointer" : "";
      return;
    }
    if (points.length > 0) setHover([e.lngLat.lng, e.lngLat.lat]);
  });

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("input, textarea, select")) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      onUndo();
    } else if (e.key === "Escape") {
      if (points.length) setPoints([]);
      else if (tool !== "select") chooseTool("select");
      else onSelect(null);
    } else if (e.key === "Enter") {
      if (tool === "polygon" || tool === "path") finish(points);
    } else if (e.key === "Backspace" && points.length) {
      e.preventDefault();
      setPoints(points.slice(0, -1));
    } else if ((e.key === "Delete" || e.key === "Backspace") && selected) {
      e.preventDefault();
      deleteSelected();
    }
  });

  useEffect(() => {
    map.on("click", onClick);
    map.on("dblclick", onDblClick);
    map.on("mousemove", onMove);
    window.addEventListener("keydown", onKey);
    return () => {
      map.off("click", onClick);
      map.off("dblclick", onDblClick);
      map.off("mousemove", onMove);
      window.removeEventListener("keydown", onKey);
      removeDraft(map);
      map.getCanvas().style.cursor = "";
    };
  }, [map]);

  useEffect(() => {
    const drawing = tool !== "select";
    map.getCanvas().style.cursor = drawing ? "crosshair" : "";
    if (drawing) map.doubleClickZoom.disable();
    else map.doubleClickZoom.enable();
  }, [map, tool]);

  useEffect(() => {
    setDraft(map, draftFeatures(tool, points, hover, grid));
  }, [map, tool, points, hover, grid]);

  // --- Rendu ----------------------------------------------------------------

  const counts = plan.features.reduce<Partial<Record<PlanKind, number>>>((acc, f) => {
    acc[f.properties.kind] = (acc[f.properties.kind] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="label">Outil</p>
        <div className="grid grid-cols-2 gap-2">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => chooseTool(t.id)}
              className={`${tool === t.id ? "btn-primary" : "btn-secondary"} ${t.id === "grid" ? "col-span-2" : ""}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-sm text-zinc-500">{TOOLS.find((t) => t.id === tool)!.help}</p>
      </div>

      {(tool === "rect" || tool === "polygon") && (
        <div>
          <label htmlFor="area-kind" className="label">
            Type d&apos;élément
          </label>
          <select
            id="area-kind"
            value={areaKind}
            onChange={(e) => setAreaKind(e.target.value as AreaKind)}
            className="input"
          >
            {AREA_KINDS.map((k) => (
              <option key={k} value={k}>
                {PLAN_KINDS[k].label}
              </option>
            ))}
          </select>
        </div>
      )}

      {tool === "grid" && (
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              ["rows", "Rangées", 1, 20],
              ["cols", "Stands par rangée", 1, 50],
            ] as const
          ).map(([key, label, min, max]) => (
            <div key={key}>
              <label htmlFor={`grid-${key}`} className="label">
                {label}
              </label>
              <input
                id={`grid-${key}`}
                type="number"
                min={min}
                max={max}
                value={grid[key]}
                onChange={(e) => {
                  const v = Math.round(Number(e.target.value));
                  if (v >= min && v <= max) setGrid({ ...grid, [key]: v });
                }}
                className="input"
              />
            </div>
          ))}
          <div>
            <label htmlFor="grid-prefix" className="label">
              Préfixe
            </label>
            <input
              id="grid-prefix"
              value={grid.prefix}
              maxLength={4}
              onChange={(e) => setGrid({ ...grid, prefix: e.target.value.toUpperCase() })}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="grid-start" className="label">
              Premier numéro
            </label>
            <input
              id="grid-start"
              type="number"
              min={0}
              value={grid.start}
              onChange={(e) => setGrid({ ...grid, start: Math.max(0, Math.round(Number(e.target.value))) })}
              className="input"
            />
          </div>
          <p className="col-span-2 text-xs text-zinc-500">
            Stands {grid.prefix}
            {grid.start} à {grid.prefix}
            {grid.start + grid.rows * grid.cols - 1}
          </p>
        </div>
      )}

      {selected && <SelectedFeature feature={selected} onUpdate={updateSelected} onDelete={deleteSelected} />}

      <div className="flex flex-col gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <p className="label">Partir d&apos;OpenStreetMap</p>
        <button type="button" onClick={importOsm} disabled={osmState.status === "loading"} className="btn-secondary">
          {osmState.status === "loading" ? "Import…" : "Importer les bâtiments de la zone"}
        </button>
        {osmState.status === "loading" && (
          <p className="text-sm text-zinc-500">
            Interrogation d&apos;OpenStreetMap… cela peut prendre jusqu&apos;à une minute.
          </p>
        )}
        {osmState.message && (
          <p className={`text-sm ${osmState.status === "error" ? "text-red-600" : "text-zinc-500"}`}>
            {osmState.message}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-zinc-200 pt-4 text-sm dark:border-zinc-800">
        <p className="text-zinc-500">
          {plan.features.length === 0
            ? "Aucun élément"
            : (Object.keys(counts) as PlanKind[]).map((k) => `${counts[k]} ${PLAN_KINDS[k].label.toLowerCase()}`).join(" · ")}
        </p>
        <button type="button" onClick={onUndo} disabled={!canUndo} className="btn-ghost px-2 py-1" title="Ctrl+Z">
          Annuler
        </button>
      </div>
    </div>
  );
}

function SelectedFeature({
  feature,
  onUpdate,
  onDelete,
}: {
  feature: PlanFeature;
  onUpdate: (patch: Partial<PlanFeature["properties"]>) => void;
  onDelete: () => void;
}) {
  const { kind, label } = feature.properties;
  const isArea = feature.geometry.type === "Polygon";
  const measure =
    feature.geometry.type === "Polygon"
      ? `${Math.round(ringArea(feature.geometry.coordinates[0].slice(0, -1) as LngLat[]))} m²`
      : formatMeters(lineLength(feature.geometry.coordinates as LngLat[]));

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-900 dark:bg-blue-950/20">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Élément sélectionné</p>
        <span className="text-xs text-zinc-500">{measure}</span>
      </div>
      {isArea && (
        <div>
          <label htmlFor="sel-kind" className="label">
            Type
          </label>
          <select
            id="sel-kind"
            value={kind}
            onChange={(e) => onUpdate({ kind: e.target.value as AreaKind })}
            className="input"
          >
            {AREA_KINDS.map((k) => (
              <option key={k} value={k}>
                {PLAN_KINDS[k].label}
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label htmlFor="sel-label" className="label">
          Nom / numéro affiché
        </label>
        <input
          id="sel-label"
          value={label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          placeholder={isArea ? "ex : Hall 1, B12…" : "ex : Allée centrale"}
          className="input"
        />
      </div>
      <button type="button" onClick={onDelete} className="btn-ghost justify-start px-0 text-red-600">
        Supprimer l&apos;élément
      </button>
    </div>
  );
}
