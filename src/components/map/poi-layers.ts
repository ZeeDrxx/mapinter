import type { ExpressionSpecification, GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import type { FeatureCollection, Point } from "geojson";
import { POI_CATEGORY_IDS, type Poi } from "@/lib/poi";
import { drawPictogram } from "@/lib/pictograms";
import { mapPalette } from "@/lib/theme";

const SOURCE = "pois";
const LAYER = "pois";

/** Calques cliquables pour la sélection d'un lieu. */
export const POI_HIT_LAYERS = [LAYER];

const PIXEL_RATIO = 2;
const PLATE = 24; // px CSS

/** Plaques de catégorie (encre, et signal pour la sélection) dessinées une fois par carte. */
function ensureIcons(map: MapLibreMap) {
  if (map.hasImage("poi-stand")) return;
  const c = mapPalette();
  const font = getComputedStyle(document.documentElement).getPropertyValue("--font-overpass").trim() || "system-ui";
  for (const category of POI_CATEGORY_IDS) {
    for (const selected of [false, true]) {
      const size = (PLATE + 4) * PIXEL_RATIO;
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext("2d")!;
      const r = 3 * PIXEL_RATIO;
      // Liseré papier : la plaque reste lisible sur n'importe quel fond
      ctx.fillStyle = c.paper;
      ctx.beginPath();
      ctx.roundRect(0, 0, size, size, r + 2 * PIXEL_RATIO);
      ctx.fill();
      ctx.fillStyle = selected ? c.signal : c.ink;
      ctx.beginPath();
      ctx.roundRect(2 * PIXEL_RATIO, 2 * PIXEL_RATIO, PLATE * PIXEL_RATIO, PLATE * PIXEL_RATIO, r);
      ctx.fill();
      drawPictogram(ctx, category, size / 2, size / 2, PLATE * PIXEL_RATIO * 0.78, selected ? c.onSignal : c.onInk, font);
      map.addImage(`poi-${category}${selected ? "-selected" : ""}`, ctx.getImageData(0, 0, size, size), {
        pixelRatio: PIXEL_RATIO,
      });
    }
  }
}

function toCollection(pois: Poi[]): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: pois.map((p) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [p.lng, p.lat] },
      properties: {
        id: p.id,
        category: p.category,
        status: p.status,
        label: p.category === "stand" ? p.code || p.name : p.name,
        // Un stand dessiné sur le plan n'a pas besoin de marqueur : la case numérotée suffit.
        // Scènes et salles gardent leur pictogramme, qui aide à les repérer.
        linked: Boolean(p.featureId) && p.category === "stand",
      },
    })),
  };
}

const visibleFilter = (selectedId: string | null): ExpressionSpecification => [
  "any",
  ["!", ["get", "linked"]],
  ["==", ["get", "id"], selectedId ?? ""],
];
const iconFor = (selectedId: string | null): ExpressionSpecification => [
  "case",
  ["==", ["get", "id"], selectedId ?? ""],
  ["concat", "poi-", ["get", "category"], "-selected"],
  ["concat", "poi-", ["get", "category"]],
];

export function setPois(map: MapLibreMap, pois: Poi[], selectedId: string | null = null) {
  const source = map.getSource<GeoJSONSource>(SOURCE);
  if (source) {
    source.setData(toCollection(pois));
    map.setFilter(LAYER, visibleFilter(selectedId));
    map.setLayoutProperty(LAYER, "icon-image", iconFor(selectedId));
    map.setLayoutProperty(LAYER, "symbol-sort-key", ["case", ["==", ["get", "id"], selectedId ?? ""], 1, 0]);
    return;
  }

  ensureIcons(map);
  const c = mapPalette();
  map.addSource(SOURCE, { type: "geojson", data: toCollection(pois) });
  const faded: ExpressionSpecification = ["case", ["==", ["get", "status"], "closed"], 0.45, 1];
  map.addLayer({
    id: LAYER,
    type: "symbol",
    source: SOURCE,
    filter: visibleFilter(selectedId),
    layout: {
      "icon-image": iconFor(selectedId),
      "icon-allow-overlap": true,
      // Les plaques ne doivent pas masquer les noms des zones et des stands
      "icon-ignore-placement": true,
      "icon-size": ["interpolate", ["linear"], ["zoom"], 15, 0.7, 18, 1],
      "symbol-sort-key": ["case", ["==", ["get", "id"], selectedId ?? ""], 1, 0],
      "text-field": ["step", ["zoom"], "", 17.5, ["get", "label"]],
      "text-font": ["Noto Sans Bold"],
      "text-size": 11.5,
      "text-anchor": "top",
      "text-offset": [0, 1.25],
      "text-max-width": 9,
      "text-optional": true,
    },
    paint: {
      "icon-opacity": faded,
      "text-opacity": faded,
      "text-color": c.ink,
      "text-halo-color": c.paper,
      "text-halo-width": 1.4,
    },
  });
}

/** Lieu sous le pointeur, s'il y en a un. */
export function poiAt(map: MapLibreMap, point: { x: number; y: number }): string | null {
  if (!map.getLayer(LAYER)) return null;
  const hit = map.queryRenderedFeatures([point.x, point.y], { layers: POI_HIT_LAYERS });
  return (hit[0]?.properties?.id as string | undefined) ?? null;
}
