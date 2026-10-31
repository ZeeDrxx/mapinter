"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  ANNOUNCEMENT_COLUMNS,
  ANNOUNCEMENT_LEVELS,
  isLive,
  rowToAnnouncement,
  type Announcement,
  type AnnouncementLevel,
} from "@/lib/announcement";

const DURATIONS = [
  { value: 0, label: "Jusqu'à retrait" },
  { value: 15, label: "15 min" },
  { value: 60, label: "1 heure" },
  { value: 180, label: "3 heures" },
];

const MAX_LENGTH = 500;

// TODO : utiliser le fuseau de l'event (même hypothèse que lib/events.ts)
const timeFormat = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

export function AnnouncementsPanel({
  eventId,
  isPublished,
  initial,
}: {
  eventId: string;
  isPublished: boolean;
  initial: Announcement[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [list, setList] = useState(initial);
  const [message, setMessage] = useState("");
  const [level, setLevel] = useState<AnnouncementLevel>("info");
  const [duration, setDuration] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const interval = setInterval(tick, 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(interval);
    };
  }, []);

  async function publish(e: React.FormEvent) {
    e.preventDefault();
    const text = message.trim();
    if (!text) return;
    setBusy(true);
    setError(null);
    const { data, error } = await supabase
      .from("announcements")
      .insert({
        event_id: eventId,
        message: text,
        level,
        expires_at: duration ? new Date(Date.now() + duration * 60_000).toISOString() : null,
      })
      .select(ANNOUNCEMENT_COLUMNS)
      .single();
    setBusy(false);
    if (error) {
      setError("L'envoi a échoué, réessayez.");
      return;
    }
    setList((l) => [rowToAnnouncement(data), ...l]);
    setMessage("");
  }

  async function withdraw(id: string) {
    const { error } = await supabase.from("announcements").update({ active: false }).eq("id", id);
    if (error) {
      setError("Le retrait a échoué, réessayez.");
      return;
    }
    setList((l) => l.map((a) => (a.id === id ? { ...a, active: false } : a)));
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between border-b border-ink pb-2">
        <h2 className="label">Annonces live</h2>
        <span className="fine">
          {isPublished ? "Affichées en direct chez les visiteurs" : "Visibles une fois l'event publié"}
        </span>
      </div>

      <form onSubmit={publish} className="well flex flex-col gap-3 p-3">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, MAX_LENGTH))}
          rows={2}
          placeholder="La conférence de 14h est déplacée en salle B."
          aria-label="Message de l'annonce"
          className="input bg-sheet"
        />
        <div className="flex flex-wrap items-center gap-2">
          <div className="segmented bg-paper-3" role="radiogroup" aria-label="Niveau">
            {(Object.keys(ANNOUNCEMENT_LEVELS) as AnnouncementLevel[]).map((l) => (
              <button key={l} type="button" role="radio" aria-checked={level === l} onClick={() => setLevel(l)}>
                {ANNOUNCEMENT_LEVELS[l].label}
              </button>
            ))}
          </div>
          <select
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            aria-label="Durée d'affichage"
            className="input min-h-[38px] w-auto bg-sheet py-2 text-[13px]"
          >
            {DURATIONS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
          <span className="num ml-auto font-mono text-[11.5px] text-t4">
            {message.length}/{MAX_LENGTH}
          </span>
          <button type="submit" disabled={busy || !message.trim()} className="btn btn-primary btn-sm">
            {busy ? "Envoi…" : "Diffuser"}
          </button>
        </div>
        {error && <p className="text-[13px] font-semibold text-busy">{error}</p>}
      </form>

      {list.length > 0 && (
        <ul>
          {list.map((a) => {
            const online = isLive(a, now);
            return (
              <li key={a.id} className="flex items-start gap-3 border-b border-hair py-3">
                <span
                  className={`label mt-0.5 w-[74px] shrink-0 text-[10px] ${
                    a.level === "alert" ? "text-t1" : a.level === "warning" ? "text-busy" : ""
                  }`}
                >
                  {ANNOUNCEMENT_LEVELS[a.level].label}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`text-[14px] whitespace-pre-line ${online ? "" : "text-t4 line-through"}`}>{a.message}</p>
                  <p className="num mt-1 flex items-center gap-1.5 text-[12px] text-t3">
                    {online && <span className="signal-dot signal-dot--live size-1.5" aria-hidden />}
                    {timeFormat.format(new Date(a.createdAt))} · 
                    {online
                      ? a.expiresAt
                        ? `en ligne jusqu'à ${timeFormat.format(new Date(a.expiresAt))}`
                        : "en ligne"
                      : a.active
                        ? "expirée"
                        : "retirée"}
                  </p>
                </div>
                {online && (
                  <button type="button" onClick={() => withdraw(a.id)} className="btn btn-ghost btn-sm -mr-2">
                    Retirer
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
