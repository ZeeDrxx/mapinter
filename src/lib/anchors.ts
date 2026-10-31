import "server-only";
import { headers } from "next/headers";
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

/**
 * URL publique du site, encodée dans les QR codes.
 * NEXT_PUBLIC_SITE_URL en production ; à défaut, l'hôte de la requête.
 */
export async function getSiteUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
