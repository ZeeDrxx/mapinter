import "server-only";
import { createClient } from "@/lib/supabase/server";
import { ANCHOR_COLUMNS, type Anchor } from "@/lib/anchor";

export async function listAnchors(eventId: string): Promise<Anchor[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("anchors")
    .select(ANCHOR_COLUMNS)
    .eq("event_id", eventId)
    .order("created_at");
  if (error) throw error;
  return data;
}

/** Ancre d'un event visible, ou null (id inconnu ou mal formé). */
export async function getAnchor(eventId: string, anchorId: string): Promise<Anchor | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("anchors")
    .select(ANCHOR_COLUMNS)
    .eq("event_id", eventId)
    .eq("id", anchorId)
    .maybeSingle();
  if (error) {
    if (error.code === "22P02") return null;
    throw error;
  }
  return data;
}
