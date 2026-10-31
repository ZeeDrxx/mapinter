import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import type { FeatureCollection } from "geojson";
import { bboxToPolygon, type BBox } from "@/lib/geo";

const SOURCE_ID = "event-zone";
export const ZONE_COLOR = "#2563eb";

function toCollection(bbox: BBox | null): FeatureCollection {
  return { type: "FeatureCollection", features: bbox ? [bboxToPolygon(bbox)] : [] };
}

/** Ajoute (si besoin) la source et les calques de la zone, puis affiche `bbox`. */
export function setZone(map: MapLibreMap, bbox: BBox | null) {
  const source = map.getSource<GeoJSONSource>(SOURCE_ID);
  if (source) {
    source.setData(toCollection(bbox));
    return;
  }
  map.addSource(SOURCE_ID, { type: "geojson", data: toCollection(bbox) });
  map.addLayer({
    id: `${SOURCE_ID}-fill`,
    type: "fill",
    source: SOURCE_ID,
    paint: { "fill-color": ZONE_COLOR, "fill-opacity": 0.12 },
  });
  map.addLayer({
    id: `${SOURCE_ID}-line`,
    type: "line",
    source: SOURCE_ID,
    paint: { "line-color": ZONE_COLOR, "line-width": 2.5, "line-dasharray": [2, 1] },
  });
}

export function fitZone(map: MapLibreMap, bbox: BBox, animate = true) {
  map.fitBounds(
    [
      [bbox[0], bbox[1]],
      [bbox[2], bbox[3]],
    ],
    { padding: 48, animate },
  );
}
