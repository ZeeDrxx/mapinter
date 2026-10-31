import type { ExpressionSpecification, GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import type { FeatureCollection } from "geojson";
import type { Anchor } from "@/lib/anchor";
import type { LngLat } from "@/lib/geo";
import { mapPalette } from "@/lib/theme";

// Le signal est la couleur de la position : ancres, « Vous êtes ici », guidage.
const signal = () => mapPalette().signal;
const paper = () => mapPalette().paper;

function upsertSource(map: MapLibreMap, id: string, data: FeatureCollection): boolean {
  const source = map.getSource<GeoJSONSource>(id);
  if (source) {
    source.setData(data);
    return false;
  }
  map.addSource(id, { type: "geojson", data });
  return true;
}

// ---------------------------------------------------------------------------
// Éditeur : toutes les ancres de l'event
// ---------------------------------------------------------------------------

const ANCHORS = "anchors";
export const ANCHOR_HIT_LAYER = `${ANCHORS}-dot`;
const selectedFilter = (id: string | null): ExpressionSpecification => ["==", ["get", "id"], id ?? ""];

export function setAnchors(map: MapLibreMap, anchors: Anchor[], selectedId: string | null = null) {
  const created = upsertSource(map, ANCHORS, {
    type: "FeatureCollection",
    features: anchors.map((a) => ({
      type: "Feature",
      properties: { id: a.id, label: a.label },
      geometry: { type: "Point", coordinates: [a.lng, a.lat] },
    })),
  });
  if (!created) {
    map.setFilter(`${ANCHORS}-selected`, selectedFilter(selectedId));
    return;
  }
  map.addLayer({
    id: `${ANCHORS}-selected`,
    type: "circle",
    source: ANCHORS,
    filter: selectedFilter(selectedId),
    paint: { "circle-radius": 18, "circle-color": signal(), "circle-opacity": 0.2 },
  });
  map.addLayer({
    id: ANCHOR_HIT_LAYER,
    type: "circle",
    source: ANCHORS,
    paint: {
      "circle-radius": 8,
      "circle-color": signal(),
      "circle-stroke-color": paper(),
      "circle-stroke-width": 3,
    },
  });
  map.addLayer({
    id: `${ANCHORS}-label`,
    type: "symbol",
    source: ANCHORS,
    minzoom: 16.5,
    layout: {
      "text-field": ["get", "label"],
      "text-font": ["Noto Sans Bold"],
      "text-size": 11,
      "text-anchor": "top",
      "text-offset": [0, 1],
      "text-optional": true,
    },
    paint: { "text-color": signal(), "text-halo-color": paper(), "text-halo-width": 1.5 },
  });
}

export function removeAnchors(map: MapLibreMap) {
  for (const id of [`${ANCHORS}-label`, ANCHOR_HIT_LAYER, `${ANCHORS}-selected`]) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  if (map.getSource(ANCHORS)) map.removeSource(ANCHORS);
}

// ---------------------------------------------------------------------------
// Visiteur : « Vous êtes ici » + trait de guidage vers le lieu choisi
// ---------------------------------------------------------------------------

const HERE = "here";
const GUIDE = "guide";

export function setHere(map: MapLibreMap, here: Anchor | null) {
  const created = upsertSource(map, HERE, {
    type: "FeatureCollection",
    features: here
      ? [{ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [here.lng, here.lat] } }]
      : [],
  });
  if (!created) return;
  map.addLayer({
    id: `${HERE}-halo`,
    type: "circle",
    source: HERE,
    paint: { "circle-radius": 22, "circle-color": signal(), "circle-opacity": 0.18 },
  });
  map.addLayer({
    id: `${HERE}-dot`,
    type: "circle",
    source: HERE,
    paint: {
      "circle-radius": 9,
      "circle-color": signal(),
      "circle-stroke-color": paper(),
      "circle-stroke-width": 3,
    },
  });
  addHerePlate(map);
  // Une plaque signal, comme sur le panneau imprimé : elle passe au-dessus de tout le reste
  map.addLayer({
    id: `${HERE}-label`,
    type: "symbol",
    source: HERE,
    layout: {
      "text-field": "Vous êtes ici",
      "text-font": ["Noto Sans Bold"],
      "text-size": 12,
      "text-anchor": "bottom",
      "text-offset": [0, -1.9],
      "text-allow-overlap": true,
      "text-ignore-placement": true,
      "icon-image": "here-plate",
      "icon-text-fit": "both",
      "icon-text-fit-padding": [4, 8, 3, 8],
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
    },
    paint: { "text-color": mapPalette().onSignal },
  });
}

/** Fond de plaque étirable (9 tranches) pour « Vous êtes ici ». */
function addHerePlate(map: MapLibreMap) {
  if (map.hasImage("here-plate")) return;
  const ratio = 2;
  const size = 24 * ratio;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = signal();
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, 3 * ratio);
  ctx.fill();
  const inner = 6 * ratio;
  map.addImage("here-plate", ctx.getImageData(0, 0, size, size), {
    pixelRatio: ratio,
    stretchX: [[inner, size - inner]],
    stretchY: [[inner, size - inner]],
    content: [inner, inner, size - inner, size - inner],
  });
}

/** Trait pointillé entre la position du visiteur et sa destination (à vol d'oiseau). */
export function setGuide(map: MapLibreMap, from: LngLat | null, to: LngLat | null) {
  const created = upsertSource(map, GUIDE, {
    type: "FeatureCollection",
    features:
      from && to
        ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [from, to] } }]
        : [],
  });
  if (!created) return;
  map.addLayer(
    {
      id: GUIDE,
      type: "line",
      source: GUIDE,
      layout: { "line-cap": "round" },
      paint: { "line-color": signal(), "line-width": 3, "line-dasharray": [0.5, 2] },
    },
    // Sous les lieux, pour ne pas masquer les pastilles
    map.getLayer("pois-selected") ? "pois-selected" : undefined,
  );
}
