// Points d'intérêt : définitions partagées entre l'éditeur et la carte visiteur.

export const POI_CATEGORIES = {
  stand: { label: "Stand", plural: "Stands", color: "#d97706", glyph: "" },
  stage: { label: "Scène", plural: "Scènes", color: "#9333ea", glyph: "♪" },
  room: { label: "Salle", plural: "Salles", color: "#0284c7", glyph: "▣" },
  food: { label: "Restauration", plural: "Restauration", color: "#ea580c", glyph: "R" },
  toilet: { label: "Toilettes", plural: "Toilettes", color: "#0891b2", glyph: "WC" },
  info: { label: "Accueil / info", plural: "Accueil", color: "#2563eb", glyph: "i" },
  first_aid: { label: "Secours", plural: "Secours", color: "#dc2626", glyph: "+" },
  entrance: { label: "Entrée", plural: "Entrées", color: "#16a34a", glyph: "↓" },
  exit: { label: "Sortie", plural: "Sorties", color: "#15803d", glyph: "↑" },
  other: { label: "Autre", plural: "Autres", color: "#52525b", glyph: "•" },
} as const;

export type PoiCategory = keyof typeof POI_CATEGORIES;
export const POI_CATEGORY_IDS = Object.keys(POI_CATEGORIES) as PoiCategory[];

export const POI_STATUSES = {
  open: { label: "Ouvert", className: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" },
  busy: { label: "Affluence", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  closed: { label: "Fermé", className: "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400" },
} as const;

export type PoiStatus = keyof typeof POI_STATUSES;

export type Poi = {
  id: string;
  category: PoiCategory;
  name: string;
  code: string | null;
  description: string | null;
  lng: number;
  lat: number;
  status: PoiStatus;
  /** Élément du plan dessiné dont ce lieu est issu (stand de la grille…). */
  featureId: string | null;
};

export const POI_COLUMNS = "id, category, name, code, description, lng, lat, status, metadata";

type PoiRow = {
  id: string;
  category: string;
  name: string;
  code: string | null;
  description: string | null;
  lng: number;
  lat: number;
  status: string;
  metadata: unknown;
};

export function rowToPoi(row: PoiRow): Poi {
  const metadata = (row.metadata ?? {}) as { featureId?: unknown };
  return {
    id: row.id,
    category: (row.category in POI_CATEGORIES ? row.category : "other") as PoiCategory,
    name: row.name,
    code: row.code,
    description: row.description,
    lng: row.lng,
    lat: row.lat,
    status: (row.status in POI_STATUSES ? row.status : "open") as PoiStatus,
    featureId: typeof metadata.featureId === "string" ? metadata.featureId : null,
  };
}

/** Libellé principal : « B12 · Acme » si un numéro existe. */
export function poiTitle(p: Pick<Poi, "name" | "code">): string {
  return p.code && p.code !== p.name ? `${p.code} · ${p.name}` : p.name;
}

const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/** Recherche insensible à la casse et aux accents ; les correspondances sur le numéro passent en tête. */
export function searchPois(pois: Poi[], query: string, limit = 8): Poi[] {
  const q = normalize(query);
  if (!q) return [];
  const scored: { poi: Poi; score: number }[] = [];
  for (const poi of pois) {
    const code = normalize(poi.code ?? "");
    const name = normalize(poi.name);
    const category = normalize(POI_CATEGORIES[poi.category].label);
    let score = 0;
    if (code === q) score = 100;
    else if (code.startsWith(q)) score = 80;
    else if (name.startsWith(q)) score = 60;
    else if (name.includes(q)) score = 40;
    else if (category.includes(q)) score = 20;
    else if (normalize(poi.description ?? "").includes(q)) score = 10;
    if (score) scored.push({ poi, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || poiTitle(a.poi).localeCompare(poiTitle(b.poi), "fr", { numeric: true }))
    .slice(0, limit)
    .map((s) => s.poi);
}
