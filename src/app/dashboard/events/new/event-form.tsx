"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ZonePicker } from "@/components/map/zone-picker";
import { slugify } from "@/lib/slug";
import type { BBox } from "@/lib/geo";
import { createEvent } from "./actions";

/** "2026-11-05T09:00" (heure locale du navigateur) → ISO UTC */
function localToIso(value: string) {
  return value ? new Date(value).toISOString() : "";
}

export function EventForm() {
  const [state, action, pending] = useActionState(createEvent, undefined);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [description, setDescription] = useState("");
  const [bbox, setBBox] = useState<BBox | null>(null);

  return (
    <form action={action} className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
      <section className="card flex flex-col gap-4 self-start">
        <h2 className="font-semibold">1. Informations</h2>
        <div>
          <label htmlFor="name" className="label">
            Nom de l&apos;event
          </label>
          <input
            id="name"
            name="name"
            required
            minLength={2}
            maxLength={120}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slugEdited) setSlug(slugify(e.target.value));
            }}
            placeholder="Forum des métiers 2026"
            className="input"
          />
        </div>
        <div>
          <label htmlFor="slug" className="label">
            Adresse publique
          </label>
          <div className="flex items-center rounded-lg border border-zinc-300 bg-white pl-3 text-sm focus-within:border-blue-500 dark:border-zinc-700 dark:bg-zinc-900">
            <span className="text-zinc-400">/e/</span>
            <input
              id="slug"
              name="slug"
              required
              value={slug}
              onChange={(e) => {
                setSlugEdited(true);
                setSlug(slugify(e.target.value));
              }}
              className="w-full bg-transparent px-1 py-2 outline-none"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="starts_at_local" className="label">
              Début
            </label>
            <input
              id="starts_at_local"
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className="input"
            />
            <input type="hidden" name="starts_at" value={localToIso(startsAt)} />
          </div>
          <div>
            <label htmlFor="ends_at_local" className="label">
              Fin
            </label>
            <input
              id="ends_at_local"
              type="datetime-local"
              value={endsAt}
              min={startsAt || undefined}
              onChange={(e) => setEndsAt(e.target.value)}
              className="input"
            />
            <input type="hidden" name="ends_at" value={localToIso(endsAt)} />
          </div>
        </div>
        <div>
          <label htmlFor="description" className="label">
            Description <span className="font-normal text-zinc-400">(facultatif)</span>
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input"
          />
        </div>
      </section>

      <section className="card flex flex-col gap-4">
        <div>
          <h2 className="font-semibold">2. Zone de l&apos;event</h2>
          <p className="text-sm text-zinc-500">
            Recherchez le lieu, puis tracez le rectangle qui englobe tout l&apos;espace de l&apos;event.
          </p>
        </div>
        <ZonePicker value={bbox} onChange={setBBox} />
        <input type="hidden" name="bbox" value={bbox?.join(",") ?? ""} />
      </section>

      <div className="flex items-center justify-end gap-3 lg:col-span-2">
        {state?.error && <p className="mr-auto text-sm text-red-600">{state.error}</p>}
        <Link href="/dashboard" className="btn-ghost">
          Annuler
        </Link>
        <button type="submit" disabled={pending || !bbox} className="btn-primary">
          {pending ? "Création…" : "Créer l'event"}
        </button>
      </div>
    </form>
  );
}
