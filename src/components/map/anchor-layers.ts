import type { ExpressionSpecification, GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import type { FeatureCollection } from "geojson";
import type { Anchor } from "@/lib/anchor";
import type { LngLat } from "@/lib/geo";

export const HERE_COLOR = "#e11d48";

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
    paint: { "circle-radius": 18, "circle-color": HERE_COLOR, "circle-opacity": 0.2 },
  });
  map.addLayer({
    id: ANCHOR_HIT_LAYER,
    type: "circle",
    source: ANCHORS,
    paint: {
      "circle-radius": 8,
      "circle-color": HERE_COLOR,
      "circle-stroke-color": "#ffffff",
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
    paint: { "text-color": HERE_COLOR, "text-halo-color": "#ffffff", "text-halo-width": 1.5 },
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
    paint: { "circle-radius": 22, "circle-color": HERE_COLOR, "circle-opacity": 0.18 },
  });
  map.addLayer({
    id: `${HERE}-dot`,
    type: "circle",
    source: HERE,
    paint: {
      "circle-radius": 9,
      "circle-color": HERE_COLOR,
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 3,
    },
  });
  map.addLayer({
    id: `${HERE}-label`,
    type: "symbol",
    source: HERE,
    layout: {
      "text-field": "Vous êtes ici",
      "text-font": ["Noto Sans Bold"],
      "text-size": 12,
      "text-anchor": "top",
      "text-offset": [0, 1.3],
      "text-allow-overlap": true,
    },
    paint: { "text-color": HERE_COLOR, "text-halo-color": "#ffffff", "text-halo-width": 2 },
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
      paint: { "line-color": HERE_COLOR, "line-width": 3, "line-dasharray": [0.5, 2] },
    },
    // Sous les lieux, pour ne pas masquer les pastilles
    map.getLayer("pois-selected") ? "pois-selected" : undefined,
  );
}
