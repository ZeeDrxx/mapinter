import "server-only";
import { createClient, getUser } from "@/lib/supabase/server";
import type { BBox } from "@/lib/geo";
import type { Tables } from "@/lib/database.types";

export type EventRow = Tables<"events">;

export function eventBBox(e: Pick<EventRow, "min_lng" | "min_lat" | "max_lng" | "max_lat">): BBox {
  return [e.min_lng, e.min_lat, e.max_lng, e.max_lat];
}

/** Events de l'organisateur connecté, du plus récent au plus ancien. */
export async function listMyEvents() {
  const user = await getUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select("id, name, slug, starts_at, ends_at, is_published, created_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

/** Un event de l'organisateur connecté, ou null s'il n'existe pas / ne lui appartient pas. */
export async function getMyEvent(id: string) {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (error) {
    // UUID mal formé dans l'URL
    if (error.code === "22P02") return null;
    throw error;
  }
  return data;
}

// TODO : stocker le fuseau horaire de chaque event au lieu de supposer Europe/Paris.
const dateFormat = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

export function formatEventDates(startsAt: string | null, endsAt: string | null) {
  if (!startsAt && !endsAt) return "Dates non définies";
  if (startsAt && endsAt) return `${dateFormat.format(new Date(startsAt))} → ${dateFormat.format(new Date(endsAt))}`;
  return dateFormat.format(new Date((startsAt ?? endsAt)!));
}
