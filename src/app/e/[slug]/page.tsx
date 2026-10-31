import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { VisitorMap } from "@/components/visitor/visitor-map";
import { eventBBox } from "@/lib/events";
import { getEventPlan } from "@/lib/layers";
import { listPois } from "@/lib/pois";
import { getVisibleEvent } from "@/lib/public-event";
import { getAnchor } from "@/lib/anchors";
import { listAnnouncements } from "@/lib/announcements";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export async function generateMetadata({ params }: PageProps<"/e/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const event = await getVisibleEvent(slug);
  if (!event) return { title: "Event introuvable" };
  return {
    title: event.name,
    description: event.description ?? `Plan interactif de ${event.name}`,
    robots: event.is_published ? undefined : { index: false },
    appleWebApp: { capable: true, title: event.name, statusBarStyle: "default" },
  };
}

export default function VisitorPage({ params, searchParams }: PageProps<"/e/[slug]">) {
  return (
    <Suspense
      fallback={
        <div className="grid h-dvh place-items-center bg-paper">
          <p className="label">Chargement du plan…</p>
        </div>
      }
    >
      <VisitorLoader params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function VisitorLoader({ params, searchParams }: Pick<PageProps<"/e/[slug]">, "params" | "searchParams">) {
  const [{ slug }, { lieu, ici }] = await Promise.all([params, searchParams]);
  const event = await getVisibleEvent(slug);
  if (!event) notFound();
  const [plan, pois, announcements, here] = await Promise.all([
    getEventPlan(event.id),
    listPois(event.id),
    listAnnouncements(event.id, { liveOnly: true }),
    typeof ici === "string" ? getAnchor(event.id, ici) : null,
  ]);

  return (
    <VisitorMap
      event={{ id: event.id, name: event.name, bbox: eventBBox(event), isPublished: event.is_published }}
      initial={{ plan, pois, announcements }}
      initialPoiId={typeof lieu === "string" ? lieu : null}
      here={here}
    />
  );
}
