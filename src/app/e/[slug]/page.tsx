import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { VisitorMap } from "@/components/visitor/visitor-map";
import { eventBBox } from "@/lib/events";
import { getEventPlan } from "@/lib/layers";
import { listPois } from "@/lib/pois";
import { getVisibleEvent } from "@/lib/public-event";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2563eb",
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
        <div className="grid h-dvh place-items-center bg-zinc-100 text-sm text-zinc-500 dark:bg-zinc-900">
          Chargement de la carte…
        </div>
      }
    >
      <VisitorLoader params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function VisitorLoader({ params, searchParams }: Pick<PageProps<"/e/[slug]">, "params" | "searchParams">) {
  const [{ slug }, { lieu }] = await Promise.all([params, searchParams]);
  const event = await getVisibleEvent(slug);
  if (!event) notFound();
  const [{ image, drawn }, pois] = await Promise.all([getEventPlan(event.id), listPois(event.id)]);

  return (
    <VisitorMap
      event={{ name: event.name, bbox: eventBBox(event), isPublished: event.is_published }}
      image={image && { url: image.url, corners: image.corners, opacity: image.opacity }}
      plan={drawn?.features ?? null}
      pois={pois}
      initialPoiId={typeof lieu === "string" ? lieu : null}
    />
  );
}
