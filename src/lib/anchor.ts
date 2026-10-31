// Ancres QR « Vous êtes ici » : définitions partagées entre l'éditeur, l'impression et la carte visiteur.

export type Anchor = { id: string; label: string; lng: number; lat: number };

export const ANCHOR_COLUMNS = "id, label, lng, lat";

/** Paramètre d'URL porté par les QR codes : /e/<slug>?ici=<id> */
export const ANCHOR_PARAM = "ici";

export function anchorUrl(siteUrl: string, slug: string, anchorId?: string): string {
  const url = new URL(`/e/${slug}`, siteUrl);
  if (anchorId) url.searchParams.set(ANCHOR_PARAM, anchorId);
  return url.toString();
}
