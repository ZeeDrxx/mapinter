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

function StepTitle({ n, title, hint }: { n: string; title: string; hint?: string }) {
  return (
    <div className="border-t border-ink pt-3">
      <p className="num font-mono text-[12px] font-semibold text-t3">{n}</p>
      <h2 className="h2 mt-1">{title}</h2>
      {hint && <p className="body mt-1 text-[14px]">{hint}</p>}
    </div>
  );
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
    <form action={action} className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.7fr)]">
      <section className="flex flex-col gap-5 self-start">
        <StepTitle n="01" title="Informations" />
        <div>
          <label htmlFor="name" className="field-label">
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
          <label htmlFor="slug" className="field-label">
            Adresse publique
          </label>
          <div className="input flex items-center gap-0.5 font-mono text-[13.5px] focus-within:bg-sheet focus-within:shadow-[inset_0_0_0_1px_var(--hair-strong),inset_0_-2px_0_var(--ink)]">
            <span className="text-t4">/e/</span>
            <input
              id="slug"
              name="slug"
              required
              value={slug}
              onChange={(e) => {
                setSlugEdited(true);
                setSlug(slugify(e.target.value));
              }}
              className="min-w-0 flex-1 bg-transparent outline-none"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="starts_at_local" className="field-label">
              Début
            </label>
            <input
              id="starts_at_local"
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className="input num"
            />
            <input type="hidden" name="starts_at" value={localToIso(startsAt)} />
          </div>
          <div>
            <label htmlFor="ends_at_local" className="field-label">
              Fin
            </label>
            <input
              id="ends_at_local"
              type="datetime-local"
              value={endsAt}
              min={startsAt || undefined}
              onChange={(e) => setEndsAt(e.target.value)}
              className="input num"
            />
            <input type="hidden" name="ends_at" value={localToIso(endsAt)} />
          </div>
        </div>
        <div>
          <label htmlFor="description" className="field-label">
            Description <span className="font-normal text-t4">· facultatif</span>
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

      <section className="flex flex-col gap-5">
        <StepTitle
          n="02"
          title="Zone de l'event"
          hint="Recherchez le lieu, puis tracez le rectangle qui englobe tout l'espace de l'event."
        />
        <ZonePicker value={bbox} onChange={setBBox} />
        <input type="hidden" name="bbox" value={bbox?.join(",") ?? ""} />
      </section>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-hair pt-5 lg:col-span-2">
        {state?.error && (
          <p role="alert" className="mr-auto text-[13.5px] font-semibold text-busy">
            {state.error}
          </p>
        )}
        <Link href="/dashboard" className="btn btn-ghost">
          Annuler
        </Link>
        <button type="submit" disabled={pending || !bbox} className="btn btn-primary">
          {pending ? "Création…" : "Créer l'event"}
        </button>
      </div>
    </form>
  );
}
