import "server-only";
import { createClient } from "@/lib/supabase/server";
import { LAYER_COLUMNS, LAYERS_BUCKET, rowsToPlan, type EventPlan } from "@/lib/layer-rows";

export type { DrawnLayer, EventPlan, ImageLayer } from "@/lib/layer-rows";
export { LAYERS_BUCKET };

/** Calques d'un event (un calque image et un calque dessiné au plus pour le MVP). */
export async function getEventPlan(eventId: string): Promise<EventPlan> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("layers")
    .select(LAYER_COLUMNS)
    .eq("event_id", eventId)
    .order("sort_order")
    .order("created_at");
  if (error) throw error;
  return rowsToPlan(data, (path) => supabase.storage.from(LAYERS_BUCKET).getPublicUrl(path).data.publicUrl);
}
