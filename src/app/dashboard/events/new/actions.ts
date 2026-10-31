"use server";

import { redirect } from "next/navigation";
import { createClient, getUser } from "@/lib/supabase/server";
import { isValidBBox } from "@/lib/geo";
import { SLUG_PATTERN } from "@/lib/slug";

export type CreateEventState = { error?: string } | undefined;

function optionalDate(value: FormDataEntryValue | null): string | null {
  const s = String(value ?? "").trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export async function createEvent(
  _prev: CreateEventState,
  formData: FormData,
): Promise<CreateEventState> {
  const user = await getUser();
  if (!user) redirect("/login");

  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const startsAt = optionalDate(formData.get("starts_at"));
  const endsAt = optionalDate(formData.get("ends_at"));
  const bbox = String(formData.get("bbox") ?? "")
    .split(",")
    .map(Number);

  if (name.length < 2) return { error: "Donnez un nom à votre event." };
  if (!SLUG_PATTERN.test(slug)) {
    return { error: "L'adresse ne peut contenir que des lettres minuscules, chiffres et tirets." };
  }
  if (!isValidBBox(bbox)) return { error: "Délimitez la zone de l'event sur la carte." };
  if (startsAt && endsAt && endsAt < startsAt) {
    return { error: "La date de fin doit être après la date de début." };
  }

  const supabase = await createClient();
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const { data, error } = await supabase
    .from("events")
    .insert({
      owner_id: user.id,
      name,
      slug,
      description,
      starts_at: startsAt,
      ends_at: endsAt,
      min_lng: minLng,
      min_lat: minLat,
      max_lng: maxLng,
      max_lat: maxLat,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return { error: "Cette adresse est déjà utilisée, choisissez-en une autre." };
    return { error: "Impossible de créer l'event. Réessayez." };
  }

  redirect(`/dashboard/events/${data.id}`);
}
