import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ZonePreview } from "@/components/map/zone-preview";
import { StatusBadge } from "@/components/status-badge";
import { eventBBox, formatEventDates, getMyEvent } from "@/lib/events";
import { getEventPlan } from "@/lib/layers";
import { listPois } from "@/lib/pois";
import { listAnchors } from "@/lib/anchors";
import { listAnnouncements } from "@/lib/announcements";
import { AnnouncementsPanel } from "./announcements-panel";
import { bboxSizeMeters, formatMeters } from "@/lib/geo";
import { setPublished } from "./actions";

type Step = { title: string; text: string; done?: boolean; action?: ReactNode };

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

  const planStatus = [image && "image calée", drawnCount > 0 && `${drawnCount} élément(s) dessiné(s)`]
    .filter(Boolean)
    .join(" · ");

  const steps: Step[] = [
    {
      title: "Calque du plan",
      text: planStatus || "Importez le plan de votre lieu et calez-le sur la carte, ou dessinez-le.",
      done: Boolean(planStatus),
      action: <Link href={editorHref} className="btn-secondary px-3 py-1.5">{planStatus ? "Modifier le plan" : "Créer le plan"}</Link>,
    },
    {
      title: "Points d'intérêt",
      text: pois.length
        ? `${pois.length} lieu(x) placé(s)`
        : "Placez stands, scènes, toilettes, sorties et services.",
      done: pois.length > 0,
      action: (
        <Link href={`${editorHref}?tab=lieux`} className="btn-secondary px-3 py-1.5">
          {pois.length ? "Gérer les lieux" : "Placer les lieux"}
        </Link>
      ),
    },
    {
      title: "QR codes « Vous êtes ici »",
      text: anchors.length
        ? `${anchors.length} QR code(s) placé(s)`
        : "Placez les QR codes sur le plan, puis imprimez les affiches à coller sur place.",
      done: anchors.length > 0,
      action: (
        <div className="flex flex-wrap gap-2">
          <Link href={`${editorHref}?tab=qr`} className="btn-secondary px-3 py-1.5">
            {anchors.length ? "Gérer les QR codes" : "Placer les QR codes"}
          </Link>
          <Link href={`/dashboard/events/${event.id}/qr`} className="btn-ghost px-3 py-1.5">
            Imprimer les affiches
          </Link>
        </div>
      ),
    },
    {
      title: "Publication",
      text: event.is_published
        ? "La carte est en ligne : partagez le lien à vos visiteurs."
        : "Une fois publiée, la carte est accessible à tous via son lien.",
      done: event.is_published,
      action: (
        <div className="flex flex-wrap gap-2">
          <form action={setPublished.bind(null, event.id, !event.is_published)}>
            <button type="submit" className={event.is_published ? "btn-secondary px-3 py-1.5" : "btn-primary px-3 py-1.5"}>
              {event.is_published ? "Dépublier" : "Publier"}
            </button>
          </form>
          <a href={visitorHref} target="_blank" rel="noreferrer" className="btn-ghost px-3 py-1.5">
            {event.is_published ? "Ouvrir la carte ↗" : "Aperçu ↗"}
          </a>
        </div>
      ),
    },
  ];

  return (
    <div className="page flex flex-col gap-6">
      <div>
        <Link href="/dashboard" className="text-sm text-zinc-500 hover:underline">
          ← Mes events
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{event.name}</h1>
          <StatusBadge published={event.is_published} />
        </div>
        <p className="mt-1 text-sm text-zinc-500">
          <span className="font-mono">/e/{event.slug}</span> · {formatEventDates(event.starts_at, event.ends_at)}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section className="flex flex-col gap-2">
          <ZonePreview
            bbox={bbox}
            image={image && { url: image.url, corners: image.corners, opacity: image.opacity }}
            plan={drawn?.features}
            pois={pois}
            className="h-[420px]"
          />
          <p className="text-sm text-zinc-500">
            Zone : {formatMeters(size.width)} × {formatMeters(size.height)}
          </p>
          <AnnouncementsPanel eventId={event.id} isPublished={event.is_published} initial={announcements} />
        </section>

        <section className="card flex flex-col gap-4 self-start">
          <h2 className="font-semibold">Mise en place</h2>
          <ol className="flex flex-col gap-4">
            {steps.map((step, i) => (
              <li key={step.title} className="flex gap-3">
                <span
                  className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                    step.done
                      ? "bg-green-600 text-white"
                      : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800"
                  }`}
                >
                  {step.done ? "✓" : i + 1}
                </span>
                <div className="flex flex-col items-start gap-2">
                  <div>
                    <p className="text-sm font-medium">{step.title}</p>
                    <p className="text-sm text-zinc-500">{step.text}</p>
                  </div>
                  {step.action ?? <span className="text-xs text-zinc-400">Bientôt</span>}
                </div>
              </li>
            ))}
          </ol>
          {event.description && (
            <p className="border-t border-zinc-200 pt-4 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
              {event.description}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

function EventSkeleton() {
  return (
    <div className="page flex flex-col gap-6">
      <div className="h-16 w-72 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
      <div className="h-[420px] animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
    </div>
  );
}
