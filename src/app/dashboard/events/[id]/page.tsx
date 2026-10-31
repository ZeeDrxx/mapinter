import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ZonePreview } from "@/components/map/zone-preview";
import { PublishMark } from "@/components/ui/status";
import { eventBBox, formatEventDates, getMyEvent } from "@/lib/events";
import { getEventPlan } from "@/lib/layers";
import { listPois } from "@/lib/pois";
import { listAnchors } from "@/lib/anchors";
import { listAnnouncements } from "@/lib/announcements";
import { bboxSizeMeters, formatMeters } from "@/lib/geo";
import { AnnouncementsPanel } from "./announcements-panel";
import { setPublished } from "./actions";

type Step = { title: string; text: string; done?: boolean; action?: ReactNode };

/** « 1 lieu placé », « 3 lieux placés » */
const count = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

export default function EventPage({ params }: PageProps<"/dashboard/events/[id]">) {
  return (
    <Suspense fallback={<EventSkeleton />}>
      <EventDetail params={params} />
    </Suspense>
  );
}

async function EventDetail({ params }: Pick<PageProps<"/dashboard/events/[id]">, "params">) {
  const { id } = await params;
  const event = await getMyEvent(id);
  if (!event) notFound();

  const [{ image, drawn }, pois, anchors, announcements] = await Promise.all([
    getEventPlan(event.id),
    listPois(event.id),
    listAnchors(event.id),
    listAnnouncements(event.id),
  ]);
  const bbox = eventBBox(event);
  const size = bboxSizeMeters(bbox);
  const drawnCount = drawn?.features.features.length ?? 0;
  const editorHref = `/dashboard/events/${event.id}/plan`;
  const visitorHref = `/e/${event.slug}`;

  const planStatus = [image && "image calée", drawnCount > 0 && count(drawnCount, "élément dessiné", "éléments dessinés")]
    .filter(Boolean)
    .join(" · ");

  const steps: Step[] = [
    {
      title: "Plan du lieu",
      text: planStatus || "Importez le plan de votre lieu et calez-le sur la carte, ou dessinez-le.",
      done: Boolean(planStatus),
      action: (
        <Link href={editorHref} className="btn btn-secondary btn-sm">
          {planStatus ? "Modifier le plan" : "Créer le plan"}
        </Link>
      ),
    },
    {
      title: "Lieux",
      text: pois.length ? count(pois.length, "lieu placé", "lieux placés") : "Placez stands, scènes, toilettes, sorties et services.",
      done: pois.length > 0,
      action: (
        <Link href={`${editorHref}?tab=lieux`} className="btn btn-secondary btn-sm">
          {pois.length ? "Gérer les lieux" : "Placer les lieux"}
        </Link>
      ),
    },
    {
      title: "QR codes « Vous êtes ici »",
      text: anchors.length
        ? count(anchors.length, "QR code placé", "QR codes placés")
        : "Placez les QR codes sur le plan, puis imprimez les affiches à coller sur place.",
      done: anchors.length > 0,
      action: (
        <div className="flex flex-wrap gap-1.5">
          <Link href={`${editorHref}?tab=qr`} className="btn btn-secondary btn-sm">
            {anchors.length ? "Gérer les QR codes" : "Placer les QR codes"}
          </Link>
          <Link href={`/dashboard/events/${event.id}/qr`} className="btn btn-ghost btn-sm">
            Imprimer les affiches
          </Link>
        </div>
      ),
    },
    {
      title: "Publication",
      text: event.is_published
        ? "La carte est en ligne : partagez son lien ou l'affiche du plan."
        : "Une fois publiée, la carte est accessible à tous via son lien.",
      done: event.is_published,
      action: (
        <div className="flex flex-wrap gap-1.5">
          <form action={setPublished.bind(null, event.id, !event.is_published)}>
            <button type="submit" className={`btn btn-sm ${event.is_published ? "btn-secondary" : "btn-primary"}`}>
              {event.is_published ? "Dépublier" : "Publier"}
            </button>
          </form>
          <a href={visitorHref} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
            {event.is_published ? "Ouvrir la carte ↗" : "Aperçu ↗"}
          </a>
        </div>
      ),
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <div className="page flex flex-col gap-10">
      <div>
        <Link href="/dashboard" className="btn btn-ghost btn-sm -ml-3">
          ← Mes events
        </Link>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="h1">{event.name}</h1>
            <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px] text-t3">
              <PublishMark published={event.is_published} />
              <span className="num">{formatEventDates(event.starts_at, event.ends_at)}</span>
              <span className="font-mono text-[12.5px]">/e/{event.slug}</span>
            </p>
          </div>
          <Link href={editorHref} className="btn btn-primary">
            Ouvrir l&apos;éditeur
          </Link>
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-10">
          <section>
            <ZonePreview
              bbox={bbox}
              image={image && { url: image.url, corners: image.corners, opacity: image.opacity }}
              plan={drawn?.features}
              pois={pois}
              className="h-[440px]"
            />
            <p className="num mt-2 font-mono text-[12px] text-t3">
              Zone {formatMeters(size.width)} × {formatMeters(size.height)}
            </p>
          </section>
          <AnnouncementsPanel eventId={event.id} isPublished={event.is_published} initial={announcements} />
        </div>

        <section className="self-start">
          <div className="flex items-baseline justify-between border-b border-ink pb-2">
            <h2 className="label">Mise en place</h2>
            <span className="num font-mono text-[12px] text-t3">
              {doneCount}/{steps.length}
            </span>
          </div>
          <ol>
            {steps.map((step, i) => (
              <li key={step.title} className="flex gap-4 border-b border-hair py-5">
                <span
                  className={`num grid size-7 shrink-0 place-items-center rounded-sign font-mono text-[12px] font-semibold ${
                    step.done ? "bg-ink text-on-ink" : "bg-paper-2 text-t3"
                  }`}
                  aria-label={step.done ? "Fait" : `Étape ${i + 1}`}
                >
                  {step.done ? (
                    <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="m2.5 6.2 2.3 2.3 4.7-5" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </span>
                <div className="flex min-w-0 flex-col items-start gap-3">
                  <div>
                    <p className="text-[15px] font-semibold">{step.title}</p>
                    <p className="mt-0.5 text-[13.5px] text-t3">{step.text}</p>
                  </div>
                  {step.action}
                </div>
              </li>
            ))}
          </ol>
          {event.description && <p className="body mt-5 text-[14px]">{event.description}</p>}
        </section>
      </div>
    </div>
  );
}

function EventSkeleton() {
  return (
    <div className="page flex flex-col gap-8">
      <div className="skeleton h-14 w-80" />
      <div className="skeleton h-[440px]" />
    </div>
  );
}
