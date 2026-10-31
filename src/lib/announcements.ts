import "server-only";
import { createClient } from "@/lib/supabase/server";
import { ANNOUNCEMENT_COLUMNS, rowToAnnouncement, type Announcement } from "@/lib/announcement";

/** Annonces d'un event, plus récentes d'abord. `liveOnly` : actives et non expirées. */
export async function listAnnouncements(eventId: string, { liveOnly = false, limit = 30 } = {}): Promise<Announcement[]> {
  const supabase = await createClient();
  let query = supabase
    .from("announcements")
    .select(ANNOUNCEMENT_COLUMNS)
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (liveOnly) {
    query = query.eq("active", true).or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data.map(rowToAnnouncement);
}
