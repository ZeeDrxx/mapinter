import type { ExpressionSpecification, GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import type { FeatureCollection, Point } from "geojson";
import { POI_CATEGORIES, POI_CATEGORY_IDS, type Poi } from "@/lib/poi";

const SOURCE = "pois";
const LAYER_SELECTED = "pois-selected";
const LAYER_STANDS = "pois-stands";
const LAYER_OTHERS = "pois-others";

/** Calques cliquables pour la sélection d'un lieu. */
export const POI_HIT_LAYERS = [LAYER_STANDS, LAYER_OTHERS];

const PIXEL_RATIO = 2;

/** Dessine les pastilles de catégorie (cercle coloré + pictogramme) et les enregistre dans la carte. */
function ensureIcons(map: MapLibreMap) {
  for (const category of POI_CATEGORY_IDS) {
    const id = `poi-${category}`;
    if (map.hasImage(id)) continue;
    const { color, glyph } = POI_CATEGORIES[category];
    const cssSize = category === "stand" ? 16 : 28;
    const size = cssSize * PIXEL_RATIO;

    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const r = size / 2;
    ctx.beginPath();
    ctx.arc(r, r, r - PIXEL_RATIO, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 2 * PIXEL_RATIO;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
    if (glyph) {
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const fontSize = (glyph.length > 1 ? 10 : 14) * PIXEL_RATIO;
      ctx.font = `700 ${fontSize}px system-ui, sans-serif`;
      ctx.fillText(glyph, r, r + PIXEL_RATIO * 0.5);
    }
    map.addImage(id, ctx.getImageData(0, 0, size, size), { pixelRatio: PIXEL_RATIO });
  }
}

function toCollection(pois: Poi[]): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: pois.map((p) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [p.lng, p.lat] },
      properties: { id: p.id, category: p.category, status: p.status, label: p.code || p.name, name: p.name },
    })),
  };
}

const selectedFilter = (id: string | null): ExpressionSpecification => ["==", ["get", "id"], id ?? ""];
const iconOpacity: ExpressionSpecification = ["case", ["==", ["get", "status"], "closed"], 0.4, 1];
const textPaint = {
  "text-color": "#18181b",
  "text-halo-color": "#ffffff",
  "text-halo-width": 1.5,
  "text-opacity": iconOpacity,
  "icon-opacity": iconOpacity,
};

export function setPois(map: MapLibreMap, pois: Poi[], selectedId: string | null = null) {
  const source = map.getSource<GeoJSONSource>(SOURCE);
  if (source) {
    source.setData(toCollection(pois));
    map.setFilter(LAYER_SELECTED, selectedFilter(selectedId));
    return;
  }

  ensureIcons(map);
  map.addSource(SOURCE, { type: "geojson", data: toCollection(pois) });
  map.addLayer({
    id: LAYER_SELECTED,
    type: "circle",
    source: SOURCE,
    filter: selectedFilter(selectedId),
    paint: {
      "circle-radius": 20,
      "circle-color": "#2563eb",
      "circle-opacity": 0.2,
      "circle-stroke-color": "#2563eb",
      "circle-stroke-width": 2,
    },
  });
  // Les stands sont nombreux : ils n'apparaissent qu'en zoomant
  map.addLayer({
    id: LAYER_STANDS,
    type: "symbol",
    source: SOURCE,
    minzoom: 16,
    filter: ["==", ["get", "category"], "stand"],
    layout: {
      "icon-image": "poi-stand",
      "icon-allow-overlap": true,
      "text-field": ["step", ["zoom"], "", 17.5, ["get", "label"]],
      "text-font": ["Noto Sans Bold"],
      "text-size": 11,
      "text-anchor": "top",
      "text-offset": [0, 0.7],
      "text-optional": true,
    },
    paint: textPaint,
  });
  map.addLayer({
    id: LAYER_OTHERS,
    type: "symbol",
    source: SOURCE,
    filter: ["!=", ["get", "category"], "stand"],
    layout: {
      "icon-image": ["concat", "poi-", ["get", "category"]],
      "icon-allow-overlap": true,
      "text-field": ["step", ["zoom"], "", 17, ["get", "name"]],
      "text-font": ["Noto Sans Bold"],
      "text-size": 12,
      "text-anchor": "top",
      "text-offset": [0, 1.1],
      "text-optional": true,
    },
    paint: textPaint,
  });
}

/** Lieu sous le pointeur, s'il y en a un. */
export function poiAt(map: MapLibreMap, point: { x: number; y: number }): string | null {
  const layers = POI_HIT_LAYERS.filter((id) => map.getLayer(id));
  if (!layers.length) return null;
  const hit = map.queryRenderedFeatures([point.x, point.y], { layers });
  return (hit[0]?.properties?.id as string | undefined) ?? null;
}
