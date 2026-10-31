import "server-only";
import { createClient } from "@/lib/supabase/server";
import { POI_COLUMNS, rowToPoi, type Poi } from "@/lib/poi";

export async function listPois(eventId: string): Promise<Poi[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pois")
    .select(POI_COLUMNS)
    .eq("event_id", eventId)
    .order("created_at");
  if (error) throw error;
  return data.map(rowToPoi);
}
