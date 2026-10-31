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
    <section className="card flex flex-col gap-4">
      <div>
        <h2 className="font-semibold">Annonces live</h2>
        <p className="text-sm text-zinc-500">
          Affichées instantanément en haut de la carte de tous les visiteurs connectés.
          {!isPublished && " Elles seront visibles une fois l'event publié."}
        </p>
      </div>

      <form onSubmit={publish} className="flex flex-col gap-3">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, MAX_LENGTH))}
          rows={2}
          placeholder="ex : La conférence de 14h est déplacée en salle B."
          aria-label="Message de l'annonce"
          className="input"
        />
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg bg-zinc-100 p-1 text-sm dark:bg-zinc-800">
            {(Object.keys(ANNOUNCEMENT_LEVELS) as AnnouncementLevel[]).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLevel(l)}
                aria-pressed={level === l}
                className={`rounded-md px-3 py-1 font-medium ${
                  level === l ? ANNOUNCEMENT_LEVELS[l].className : "text-zinc-500"
                }`}
              >
                {ANNOUNCEMENT_LEVELS[l].label}
              </button>
            ))}
          </div>
          <select
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            aria-label="Durée d'affichage"
            className="input w-auto"
          >
            {DURATIONS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
          <span className="ml-auto text-xs text-zinc-400">
            {message.length}/{MAX_LENGTH}
          </span>
          <button type="submit" disabled={busy || !message.trim()} className="btn-primary">
            {busy ? "Envoi…" : "Diffuser"}
          </button>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>

      {list.length > 0 && (
        <ul className="flex flex-col divide-y divide-zinc-200 border-t border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {list.map((a) => {
            const online = isLive(a, now);
            return (
              <li key={a.id} className="flex items-start gap-3 py-3">
                <span className={`mt-0.5 rounded-full px-2 py-0.5 text-xs font-medium ${ANNOUNCEMENT_LEVELS[a.level].className}`}>
                  {ANNOUNCEMENT_LEVELS[a.level].label}
                </span>
                <div className="flex-1">
                  <p className={`text-sm whitespace-pre-line ${online ? "" : "text-zinc-400 line-through"}`}>{a.message}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {timeFormat.format(new Date(a.createdAt))} ·{" "}
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
                  <button type="button" onClick={() => withdraw(a.id)} className="btn-ghost px-2 py-1 text-red-600">
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
