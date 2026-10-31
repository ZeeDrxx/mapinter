import "server-only";
import { cacheLife } from "next/cache";
import type { BBox, LngLat } from "./geo";
import { ringArea } from "./plan";

// Instances publiques, essayées dans l'ordre (la principale est souvent saturée).
const OVERPASS_URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];
// La politique d'usage d'Overpass demande d'identifier l'application appelante.
const USER_AGENT = "MapInter/0.1 (plans d'events interactifs)";
const MAX_BUILDINGS = 300;

type OverpassPoint = { lat: number; lon: number };
type OverpassElement =
  | { type: "way"; id: number; tags?: Record<string, string>; geometry?: OverpassPoint[] }
  | {
      type: "relation";
      id: number;
      tags?: Record<string, string>;
      members?: { type: string; role: string; geometry?: OverpassPoint[] }[];
    };

export type OsmBuilding = { osmId: string; name: string; ring: LngLat[] };

function toRing(points: OverpassPoint[] | undefined): LngLat[] | null {
  if (!points || points.length < 4) return null;
  const first = points[0];
  const last = points[points.length - 1];
  if (first.lat !== last.lat || first.lon !== last.lon) return null;
  // Anneau sans le point de fermeture
  return points.slice(0, -1).map((p) => [p.lon, p.lat]);
}

// Une instance chargée peut mettre ~40 s à répondre sur un grand site.
const ATTEMPT_TIMEOUT_MS = 50_000;

async function queryOverpass(query: string): Promise<OverpassElement[]> {
  let lastError: unknown;
  for (const url of OVERPASS_URLS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`Overpass ${res.status} (${url})`);
      return ((await res.json()) as { elements: OverpassElement[] }).elements;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
}

/**
 * Contours des bâtiments OpenStreetMap qui touchent la zone (API Overpass).
 * Mis en cache par zone : les bâtiments changent rarement et Overpass est lent.
 */
export async function fetchOsmBuildings(bbox: BBox): Promise<OsmBuilding[]> {
  "use cache";
  cacheLife("days");

  const [w, s, e, n] = bbox;
  const area = `(${s},${w},${n},${e})`;
  const query = `[out:json][timeout:45];(way["building"]${area};relation["building"]["type"="multipolygon"]${area};);out geom;`;

  const elements = await queryOverpass(query);

  const buildings: OsmBuilding[] = [];
  for (const el of elements) {
    const name = el.tags?.name ?? "";
    if (el.type === "way") {
      const ring = toRing(el.geometry);
      if (ring) buildings.push({ osmId: `way/${el.id}`, name, ring });
    } else {
      el.members
        ?.filter((m) => m.type === "way" && m.role === "outer")
        .forEach((m, i) => {
          const ring = toRing(m.geometry);
          if (ring) buildings.push({ osmId: `relation/${el.id}/${i}`, name, ring });
        });
    }
  }
  // Les plus grands d'abord : ce sont les halls et pavillons qui comptent pour un event
  return buildings
    .map((b) => ({ b, area: ringArea(b.ring) }))
    .sort((x, y) => y.area - x.area)
    .slice(0, MAX_BUILDINGS)
    .map(({ b }) => b);
}
