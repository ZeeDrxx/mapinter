import "server-only";
import { headers } from "next/headers";

/**
 * URL publique du site (QR codes imprimés, liens des e-mails).
 * NEXT_PUBLIC_SITE_URL en production ; à défaut, l'hôte de la requête.
 */
export async function getSiteUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
