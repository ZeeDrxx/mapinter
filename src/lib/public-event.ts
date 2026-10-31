import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * Event visible par le visiteur courant : publié, ou brouillon de l'organisateur connecté (aperçu).
 * La RLS fait le tri. `cache` évite une 2e requête entre generateMetadata et la page.
 */
export const getVisibleEvent = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select("id, name, slug, description, starts_at, ends_at, is_published, min_lng, min_lat, max_lng, max_lat")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data;
});
