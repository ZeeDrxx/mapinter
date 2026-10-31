import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlanEditor, type EditorTab } from "@/components/plan/plan-editor";
import { eventBBox, getMyEvent } from "@/lib/events";
import { getEventPlan } from "@/lib/layers";
import { listPois } from "@/lib/pois";

export const metadata: Metadata = { title: "Carte de l'event" };

const TAB_PARAMS: Record<string, EditorTab> = { image: "image", dessin: "draw", lieux: "pois" };

export default function PlanPage({ params, searchParams }: PageProps<"/dashboard/events/[id]/plan">) {
  return (
    <Suspense
      fallback={
        <div className="grid flex-1 place-items-center text-sm text-zinc-500">Chargement de l&apos;éditeur…</div>
      }
    >
      <PlanLoader params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function PlanLoader({
  params,
  searchParams,
}: Pick<PageProps<"/dashboard/events/[id]/plan">, "params" | "searchParams">) {
  const [{ id }, { tab }] = await Promise.all([params, searchParams]);
  const event = await getMyEvent(id);
  if (!event) notFound();
  const [{ image, drawn }, pois] = await Promise.all([getEventPlan(event.id), listPois(event.id)]);

  return (
    <PlanEditor
      event={{ id: event.id, name: event.name, slug: event.slug, bbox: eventBBox(event) }}
      initialImage={image}
      initialDrawn={drawn}
      initialPois={pois}
      initialTab={typeof tab === "string" ? TAB_PARAMS[tab] : undefined}
    />
  );
}
