import type { Feature, Polygon } from "geojson";

export type LngLat = [lng: number, lat: number];
/** [minLng, minLat, maxLng, maxLat] */
export type BBox = [number, number, number, number];

export function bboxFromCorners(a: LngLat, b: LngLat): BBox {
  return [
    Math.min(a[0], b[0]),
    Math.min(a[1], b[1]),
    Math.max(a[0], b[0]),
    Math.max(a[1], b[1]),
  ];
}

export function bboxToPolygon(b: BBox): Feature<Polygon> {
  const [w, s, e, n] = b;
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]],
    },
  };
}

const EARTH_RADIUS_M = 6_371_008.8;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Distance en mètres entre deux points (haversine). */
export function distanceMeters(a: LngLat, b: LngLat): number {
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** Largeur et hauteur approximatives de la zone, en mètres. */
export function bboxSizeMeters(b: BBox): { width: number; height: number } {
  const [w, s, e, n] = b;
  const midLat = (s + n) / 2;
  return {
    width: distanceMeters([w, midLat], [e, midLat]),
    height: distanceMeters([w, s], [w, n]),
  };
}

/** Cap de a vers b, en degrés (0 = nord, 90 = est). */
export function bearingDegrees(a: LngLat, b: LngLat): number {
  const φ1 = toRad(a[1]);
  const φ2 = toRad(b[1]);
  const Δλ = toRad(b[0] - a[0]);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

const CARDINALS = ["nord", "nord-est", "est", "sud-est", "sud", "sud-ouest", "ouest", "nord-ouest"];

export function cardinal(bearing: number): string {
  return CARDINALS[Math.round(bearing / 45) % 8];
}

/** Temps de marche, à 1,2 m/s (allure de visite). */
export function walkingMinutes(meters: number): number {
  return Math.max(1, Math.round(meters / 1.2 / 60));
}

export function formatMeters(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`;
}

export function isValidBBox(b: number[]): b is BBox {
  if (b.length !== 4 || b.some((v) => !Number.isFinite(v))) return false;
  const [w, s, e, n] = b;
  return w >= -180 && e <= 180 && s >= -90 && n <= 90 && w < e && s < n;
}
