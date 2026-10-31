import type {
  ExpressionSpecification,
  GeoJSONSource,
  ImageSource,
  Map as MapLibreMap,
} from "maplibre-gl";
import type { FeatureCollection, Point } from "geojson";
import { ringCentroid, toLocal, type Corners, type PlanCollection, type PlanKind } from "@/lib/plan";
import type { LngLat } from "@/lib/geo";
import { mapPalette } from "@/lib/theme";

// ---------------------------------------------------------------------------
// Image calée
// ---------------------------------------------------------------------------

const IMAGE_SOURCE = "plan-image";
const IMAGE_LAYER = "plan-image";
const loadedImageUrl = new WeakMap<MapLibreMap, string>();

export type PlanImage = { url: string; corners: Corners; opacity: number };

export function setPlanImage(map: MapLibreMap, image: PlanImage | null) {
  const current = loadedImageUrl.get(map);

  if (!image || (current && current !== image.url)) {
    if (map.getLayer(IMAGE_LAYER)) map.removeLayer(IMAGE_LAYER);
    if (map.getSource(IMAGE_SOURCE)) map.removeSource(IMAGE_SOURCE);
    loadedImageUrl.delete(map);
    if (!image) return;
  }

  const source = map.getSource<ImageSource>(IMAGE_SOURCE);
  if (source) {
    source.setCoordinates(image.corners);
  } else {
    map.addSource(IMAGE_SOURCE, { type: "image", url: image.url, coordinates: image.corners });
    map.addLayer(
      {
        id: IMAGE_LAYER,
        type: "raster",
        source: IMAGE_SOURCE,
        paint: { "raster-fade-duration": 0, "raster-resampling": "linear" },
      },
      // L'image passe sous les éléments dessinés
      map.getLayer(PLAN_FILL) ? PLAN_FILL : undefined,
    );
    loadedImageUrl.set(map, image.url);
  }
  map.setPaintProperty(IMAGE_LAYER, "raster-opacity", image.opacity);
}

// ---------------------------------------------------------------------------
// Éléments dessinés : un plan imprimé, à l'encre
// ---------------------------------------------------------------------------

const PLAN_SOURCE = "plan";
export const PLAN_FILL = "plan-fill";
const PLAN_OUTLINE = "plan-outline";
export const PLAN_PATH = "plan-path";
const PLAN_SELECTED = "plan-selected";

/** Calques cliquables pour la sélection. */
export const PLAN_HIT_LAYERS = [PLAN_FILL, PLAN_PATH];

/** Densité d'encre par type : remplissage et trait. Les stands sont des cases blanches détourées. */
const INK: Record<Exclude<PlanKind, "path">, { fill: number; line: number }> = {
  hall: { fill: 0.035, line: 0.42 },
  zone: { fill: 0.07, line: 0.22 },
  stand: { fill: 0, line: 0.5 },
  stage: { fill: 0.16, line: 0.55 },
  obstacle: { fill: 0.55, line: 0.55 },
};

function byKind(prop: "fill" | "line"): ExpressionSpecification {
  const pairs = (Object.keys(INK) as (keyof typeof INK)[]).flatMap((k) => [k, INK[k][prop]]);
  return ["match", ["get", "kind"], ...pairs, INK.zone[prop]] as unknown as ExpressionSpecification;
}

const selectedFilter = (id: string | null): ExpressionSpecification => ["==", ["get", "id"], id ?? ""];
const isPolygon: ExpressionSpecification = ["==", ["geometry-type"], "Polygon"];

// ---------------------------------------------------------------------------
// Étiquettes : une par élément, calculée ici. Laisser MapLibre les placer sur les géométries
// les répète à chaque découpage de tuile (« Allée nord » deux fois).
// ---------------------------------------------------------------------------

const LABEL_SOURCE = "plan-labels";

/** Milieu d'une polyligne et angle du texte pour qu'il suive l'allée, toujours lisible. */
function lineMiddle(points: LngLat[]): { at: LngLat; rotate: number } {
  const lengths = points.slice(1).map((p, i) => Math.hypot(...toLocal(points[i], p)));
  let half = lengths.reduce((a, b) => a + b, 0) / 2;
  let i = 0;
  while (i < lengths.length - 1 && half > lengths[i]) half -= lengths[i++];
  const [a, b] = [points[i], points[i + 1]];
  const t = lengths[i] ? half / lengths[i] : 0;
  const [dx, dy] = toLocal(a, b);
  let rotate = (Math.atan2(dx, dy) * 180) / Math.PI - 90;
  if (rotate > 90) rotate -= 180;
  if (rotate <= -90) rotate += 180;
  return { at: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], rotate };
}

function labelPoints(plan: PlanCollection): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: plan.features
      .filter((f) => f.properties.label.trim())
      .map((f) => {
        const { kind, label } = f.properties;
        if (f.geometry.type === "Polygon") {
          const ring = f.geometry.coordinates[0].slice(0, -1) as LngLat[];
          return { type: "Feature", properties: { kind, label, rotate: 0 }, geometry: { type: "Point", coordinates: ringCentroid(ring) } };
        }
        const { at, rotate } = lineMiddle(f.geometry.coordinates as LngLat[]);
        return { type: "Feature", properties: { kind, label, rotate }, geometry: { type: "Point", coordinates: at } };
      }),
  };
}

export function setPlanFeatures(map: MapLibreMap, plan: PlanCollection, selectedId: string | null = null) {
  const source = map.getSource<GeoJSONSource>(PLAN_SOURCE);
  if (source) {
    source.setData(plan);
    map.getSource<GeoJSONSource>(LABEL_SOURCE)?.setData(labelPoints(plan));
    map.setFilter(PLAN_SELECTED, selectedFilter(selectedId));
    return;
  }

  const c = mapPalette();
  map.addSource(PLAN_SOURCE, { type: "geojson", data: plan });
  map.addSource(LABEL_SOURCE, { type: "geojson", data: labelPoints(plan) });

  // Allées : des bandes claires, sous tout le reste
  map.addLayer({
    id: PLAN_PATH,
    type: "line",
    source: PLAN_SOURCE,
    filter: ["==", ["geometry-type"], "LineString"],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": c.ink,
      "line-opacity": 0.07,
      "line-width": ["interpolate", ["exponential", 2], ["zoom"], 15, 1.5, 18, 10, 20, 40],
    },
  });
  map.addLayer({
    id: PLAN_FILL,
    type: "fill",
    source: PLAN_SOURCE,
    filter: isPolygon,
    paint: {
      "fill-color": ["case", ["==", ["get", "kind"], "stand"], c.sheet, c.ink],
      "fill-opacity": ["case", ["==", ["get", "kind"], "stand"], 0.92, byKind("fill")],
    },
  });
  map.addLayer({
    id: PLAN_OUTLINE,
    type: "line",
    source: PLAN_SOURCE,
    filter: isPolygon,
    paint: {
      "line-color": c.ink,
      "line-opacity": byKind("line"),
      "line-width": ["interpolate", ["linear"], ["zoom"], 16, 0.6, 19, 1.4],
    },
  });
  map.addLayer({
    id: PLAN_SELECTED,
    type: "line",
    source: PLAN_SOURCE,
    filter: selectedFilter(selectedId),
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": c.signal, "line-width": 2.5 },
  });

  const halo = { "text-halo-color": c.paper, "text-halo-width": 1.4 };
  // Grands espaces : en capitales espacées, comme une signalétique de hall
  map.addLayer({
    id: "plan-label-area",
    type: "symbol",
    source: LABEL_SOURCE,
    minzoom: 15.5,
    filter: ["match", ["get", "kind"], ["hall", "zone", "stage"], true, false],
    layout: {
      "text-field": ["get", "label"],
      "text-font": ["Noto Sans Bold"],
      "text-transform": "uppercase",
      "text-letter-spacing": 0.12,
      "text-size": ["interpolate", ["linear"], ["zoom"], 16, 9, 19, 13],
      "text-max-width": 9,
      // Au-dessus du centre : la plaque du lieu associé occupe le centre
      "text-anchor": "bottom",
      "text-offset": [0, -1.4],
    },
    paint: { "text-color": c.inkAlpha(0.62), ...halo },
  });
  // Numéros de stand
  map.addLayer({
    id: "plan-label-stand",
    type: "symbol",
    source: LABEL_SOURCE,
    minzoom: 17,
    filter: ["==", ["get", "kind"], "stand"],
    layout: {
      "text-field": ["get", "label"],
      "text-font": ["Noto Sans Bold"],
      "text-size": ["interpolate", ["linear"], ["zoom"], 17, 9, 20, 14],
    },
    paint: { "text-color": c.ink, ...halo },
  });
  // Noms d'allées, dans le sens de l'allée
  map.addLayer({
    id: "plan-label-path",
    type: "symbol",
    source: LABEL_SOURCE,
    minzoom: 17.5,
    filter: ["==", ["get", "kind"], "path"],
    layout: {
      "text-field": ["get", "label"],
      "text-font": ["Noto Sans Italic"],
      "text-size": 11,
      "text-rotate": ["get", "rotate"],
      "text-rotation-alignment": "map",
    },
    paint: { "text-color": c.inkAlpha(0.5), ...halo },
  });
}
