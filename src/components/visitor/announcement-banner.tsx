"use client";

import { useEffect, useState } from "react";
import { ANNOUNCEMENT_LEVELS, isLive, type Announcement } from "@/lib/announcement";

const MAX_SHOWN = 2;
const TICK_MS = 30_000;

/** Annonces en cours (les plus récentes d'abord), masquables par le visiteur. */
export function AnnouncementBanner({ announcements }: { announcements: Announcement[] }) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  // Heure courante, rafraîchie pour faire disparaître les annonces expirées
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const interval = setInterval(tick, TICK_MS);
    return () => {
      clearTimeout(first);
      clearInterval(interval);
    };
  }, []);

  const shown = announcements.filter((a) => isLive(a, now) && !dismissed.has(a.id)).slice(0, MAX_SHOWN);
  if (!shown.length) return null;

  return (
    <div className="pointer-events-auto mx-auto flex w-full max-w-md flex-col gap-2" aria-live="polite">
      {shown.map((a) => (
        <div
          key={a.id}
          role={a.level === "alert" ? "alert" : "status"}
          className={`flex items-start gap-3 rounded-2xl px-4 py-3 text-sm shadow-lg ${ANNOUNCEMENT_LEVELS[a.level].className}`}
        >
          <p className="flex-1 whitespace-pre-line">
            {a.level !== "info" && <strong className="mr-1">{ANNOUNCEMENT_LEVELS[a.level].label} ·</strong>}
            {a.message}
          </p>
          <button
            type="button"
            onClick={() => setDismissed((s) => new Set(s).add(a.id))}
            aria-label="Masquer l'annonce"
            className="-mr-1 grid size-6 shrink-0 place-items-center rounded-full bg-white/20 text-xs"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
