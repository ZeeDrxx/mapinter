import "server-only";
import { createClient } from "@/lib/supabase/server";
import { parseCorners, parsePlan, type Corners, type PlanCollection } from "@/lib/plan";

export const LAYERS_BUCKET = "layers";

export type ImageLayer = { id: string; path: string; url: string; corners: Corners; opacity: number };
export type DrawnLayer = { id: string; features: PlanCollection };
export type EventPlan = { image: ImageLayer | null; drawn: DrawnLayer | null };

/** Calques d'un event (un calque image et un calque dessiné au plus pour le MVP). */
export async function getEventPlan(eventId: string): Promise<EventPlan> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("layers")
    .select("id, kind, image_path, corners, features, opacity")
    .eq("event_id", eventId)
    .order("sort_order")
    .order("created_at");
  if (error) throw error;

  let image: ImageLayer | null = null;
  let drawn: DrawnLayer | null = null;
  for (const layer of data) {
    if (layer.kind === "image" && !image && layer.image_path) {
      const corners = parseCorners(layer.corners);
      if (!corners) continue;
      const { publicUrl } = supabase.storage.from(LAYERS_BUCKET).getPublicUrl(layer.image_path).data;
      image = { id: layer.id, path: layer.image_path, url: publicUrl, corners, opacity: layer.opacity };
    } else if (layer.kind === "drawn" && !drawn) {
      drawn = { id: layer.id, features: parsePlan(layer.features) };
    }
  }
  return { image, drawn };
}
