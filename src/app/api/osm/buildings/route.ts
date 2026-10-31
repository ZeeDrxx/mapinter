import { getUser } from "@/lib/supabase/server";
import { bboxSizeMeters, isValidBBox } from "@/lib/geo";
import { fetchOsmBuildings } from "@/lib/osm";

// Au-delà, la requête Overpass devient lourde et n'a plus de sens pour un event.
const MAX_SIDE_METERS = 5000;

/** GET /api/osm/buildings?bbox=ouest,sud,est,nord — réservé aux organisateurs connectés. */
export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return Response.json({ error: "Non authentifié" }, { status: 401 });

  const bbox = (new URL(request.url).searchParams.get("bbox") ?? "").split(",").map(Number);
  if (!isValidBBox(bbox)) return Response.json({ error: "Zone invalide" }, { status: 400 });
  const { width, height } = bboxSizeMeters(bbox);
  if (width > MAX_SIDE_METERS || height > MAX_SIDE_METERS) {
    return Response.json({ error: "Zone trop grande" }, { status: 400 });
  }

  try {
    const buildings = await fetchOsmBuildings(bbox);
    return Response.json({ buildings });
  } catch (e) {
    console.error("Overpass", e);
    return Response.json({ error: "OpenStreetMap indisponible" }, { status: 502 });
  }
}
