import type {
  ExpressionSpecification,
  GeoJSONSource,
  ImageSource,
  Map as MapLibreMap,
} from "maplibre-gl";
import { PLAN_KINDS, type Corners, type PlanCollection, type PlanKind } from "@/lib/plan";

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
// Éléments dessinés
// ---------------------------------------------------------------------------

const PLAN_SOURCE = "plan";
export const PLAN_FILL = "plan-fill";
const PLAN_OUTLINE = "plan-outline";
export const PLAN_PATH = "plan-path";
const PLAN_SELECTED = "plan-selected";
const PLAN_LABEL = "plan-label";

/** Calques cliquables pour la sélection. */
export const PLAN_HIT_LAYERS = [PLAN_FILL, PLAN_PATH];

function byKind(prop: "color" | "opacity"): ExpressionSpecification {
  const pairs = (Object.keys(PLAN_KINDS) as PlanKind[]).flatMap((k) => [k, PLAN_KINDS[k][prop]]);
  return ["match", ["get", "kind"], ...pairs, prop === "color" ? "#888888" : 0.5] as unknown as ExpressionSpecification;
}

const selectedFilter = (id: string | null): ExpressionSpecification => ["==", ["get", "id"], id ?? ""];

export function setPlanFeatures(map: MapLibreMap, plan: PlanCollection, selectedId: string | null = null) {
  const source = map.getSource<GeoJSONSource>(PLAN_SOURCE);
  if (source) {
    source.setData(plan);
    map.setFilter(PLAN_SELECTED, selectedFilter(selectedId));
    return;
  }

  map.addSource(PLAN_SOURCE, { type: "geojson", data: plan });
  map.addLayer({
    id: PLAN_FILL,
    type: "fill",
    source: PLAN_SOURCE,
    filter: ["==", ["geometry-type"], "Polygon"],
    paint: { "fill-color": byKind("color"), "fill-opacity": byKind("opacity") },
  });
  map.addLayer({
    id: PLAN_OUTLINE,
    type: "line",
    source: PLAN_SOURCE,
    filter: ["==", ["geometry-type"], "Polygon"],
    paint: { "line-color": byKind("color"), "line-width": 1.5 },
  });
  map.addLayer({
    id: PLAN_PATH,
    type: "line",
    source: PLAN_SOURCE,
    filter: ["==", ["geometry-type"], "LineString"],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": byKind("color"),
      "line-width": ["interpolate", ["linear"], ["zoom"], 15, 2, 19, 8],
      "line-opacity": 0.85,
    },
  });
  map.addLayer({
    id: PLAN_SELECTED,
    type: "line",
    source: PLAN_SOURCE,
    filter: selectedFilter(selectedId),
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": "#2563eb", "line-width": 3 },
  });
  for (const geometry of ["Polygon", "LineString"] as const) {
    map.addLayer({
      id: `${PLAN_LABEL}-${geometry}`,
      type: "symbol",
      source: PLAN_SOURCE,
      filter: ["all", ["==", ["geometry-type"], geometry], ["!=", ["get", "label"], ""]],
      layout: {
        "text-field": ["get", "label"],
        // Police servie par le fond de carte OpenFreeMap
        "text-font": ["Noto Sans Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 16, 10, 20, 16],
        "symbol-placement": geometry === "Polygon" ? "point" : "line-center",
      },
      paint: { "text-color": "#18181b", "text-halo-color": "#ffffff", "text-halo-width": 1.5 },
    });
  }
}
