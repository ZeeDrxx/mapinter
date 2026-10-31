// Annonces live : définitions partagées entre l'organisateur et la carte visiteur.

export const ANNOUNCEMENT_LEVELS = {
  info: { label: "Info", className: "bg-blue-600 text-white" },
  warning: { label: "Important", className: "bg-amber-500 text-white" },
  alert: { label: "Alerte", className: "bg-red-600 text-white" },
} as const;

export type AnnouncementLevel = keyof typeof ANNOUNCEMENT_LEVELS;

export type Announcement = {
  id: string;
  message: string;
  level: AnnouncementLevel;
  active: boolean;
  expiresAt: string | null;
  createdAt: string;
};

export const ANNOUNCEMENT_COLUMNS = "id, message, level, active, expires_at, created_at";

type AnnouncementRow = {
  id: string;
  message: string;
  level: string;
  active: boolean;
  expires_at: string | null;
  created_at: string;
};

export function rowToAnnouncement(row: AnnouncementRow): Announcement {
  return {
    id: row.id,
    message: row.message,
    level: (row.level in ANNOUNCEMENT_LEVELS ? row.level : "info") as AnnouncementLevel,
    active: row.active,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

/** Affichée aux visiteurs : active et non expirée. `now` absent = on ne filtre pas l'expiration. */
export function isLive(a: Announcement, now: number | null): boolean {
  return a.active && (!a.expiresAt || now === null || Date.parse(a.expiresAt) > now);
}

/** Plus récentes d'abord. */
export function sortAnnouncements(list: Announcement[]): Announcement[] {
  return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
