"use client";

import { useEffect, useState } from "react";
import { ANNOUNCEMENT_LEVELS, isLive, type Announcement } from "@/lib/announcement";

const TICK_MS = 30_000;

const TONE = {
  info: { panel: "bg-sheet text-t1", label: "text-t3", mark: null },
  warning: { panel: "bg-sheet text-t1", label: "text-busy", mark: "bg-busy" },
  alert: { panel: "bg-ink text-on-ink", label: "text-on-ink", mark: null },
} as const;

/** Annonces en cours (les plus récentes d'abord), masquables par le visiteur. */
export function AnnouncementBanner({ announcements }: { announcements: Announcement[] }) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState(false);
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

  // Une seule annonce à la fois par défaut : la carte reste visible, surtout sur mobile
  const live = announcements.filter((a) => isLive(a, now) && !dismissed.has(a.id));
  const shown = expanded ? live : live.slice(0, 1);
  if (!live.length) return null;

  return (
    <div className="pointer-events-auto flex flex-col gap-1.5" aria-live="polite">
      {shown.map((a) => {
        const tone = TONE[a.level];
        return (
          <div
            key={a.id}
            role={a.level === "alert" ? "alert" : "status"}
            className={`rise flex items-start gap-3 rounded-sign py-2.5 pr-2 pl-3.5 shadow-sheet ${tone.panel}`}
          >
            <div className="min-w-0 flex-1">
              <p className={`label flex items-center gap-1.5 text-[10px] ${tone.label}`}>
                {a.level === "alert" && (
                  <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden>
                    <path d="M6 1 11.2 10.5H.8Z" fill="currentColor" />
                    <path d="M6 4.6v2.6M6 8.7v.1" stroke="var(--ink)" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                )}
                {tone.mark && <span className={`size-1.5 rounded-full ${tone.mark}`} aria-hidden />}
                {ANNOUNCEMENT_LEVELS[a.level].label}
              </p>
              <p className={`mt-0.5 text-[13.5px] leading-snug font-medium whitespace-pre-line ${expanded ? "" : "line-clamp-2"}`}>
                {a.message}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDismissed((s) => new Set(s).add(a.id))}
              aria-label="Masquer l'annonce"
              className="grid size-7 shrink-0 place-items-center rounded-sign opacity-60 transition-opacity hover:opacity-100"
            >
              <svg viewBox="0 0 16 16" width="12" height="12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                <path d="m3.5 3.5 9 9m0-9-9 9" />
              </svg>
            </button>
          </div>
        );
      })}
      {live.length > 1 && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="self-start rounded-sign bg-sheet px-2.5 py-1 text-[12px] font-semibold text-t2 shadow-sheet transition-colors hover:bg-paper-2"
        >
          {expanded ? "Réduire" : `+ ${live.length - 1} autre${live.length > 2 ? "s" : ""} annonce${live.length > 2 ? "s" : ""}`}
        </button>
      )}
    </div>
  );
}
