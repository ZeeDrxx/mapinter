import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { formatEventDates, listMyEvents } from "@/lib/events";
import { PublishMark } from "@/components/ui/status";

export const metadata: Metadata = { title: "Mes events" };

export default function DashboardPage() {
  return (
    <div className="page flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label">Organisateur</p>
          <h1 className="h1 mt-2">Mes events</h1>
        </div>
        <Link href="/dashboard/events/new" className="btn btn-primary">
          <span aria-hidden className="text-[18px] leading-none font-medium">+</span>
          Nouvel event
        </Link>
      </div>
      <Suspense fallback={<EventListSkeleton />}>
        <EventList />
      </Suspense>
    </div>
  );
}

async function EventList() {
  const events = await listMyEvents();

  if (events.length === 0) {
    return (
      <div className="well flex flex-col items-start gap-3 p-8">
        <span className="signal-dot" aria-hidden />
        <p className="h2">Aucun event pour l&apos;instant</p>
        <p className="body max-w-[44ch]">
          Commencez par délimiter le lieu de votre premier event : salle, parc des expositions, campus…
        </p>
        <Link href="/dashboard/events/new" className="btn btn-primary mt-2">
          Créer un event
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-b border-ink pb-2 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_120px]">
        <span className="label">Event</span>
        <span className="label hidden md:block">Dates</span>
        <span className="label text-right">État</span>
      </div>
      <ul>
        {events.map((e) => (
          <li key={e.id} className="border-b border-hair">
            <Link
              href={`/dashboard/events/${e.id}`}
              className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-4 transition-colors hover:bg-paper-2 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_120px] md:px-2 md:-mx-2"
            >
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-semibold group-hover:underline group-hover:underline-offset-4">
                  {e.name}
                </span>
                <span className="mt-0.5 block truncate font-mono text-[12px] text-t3">/e/{e.slug}</span>
                <span className="num mt-1 block text-[13px] text-t3 md:hidden">{formatEventDates(e.starts_at, e.ends_at)}</span>
              </span>
              <span className="num hidden text-[13.5px] text-t2 md:block">{formatEventDates(e.starts_at, e.ends_at)}</span>
              <span className="text-right">
                <PublishMark published={e.is_published} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EventListSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="skeleton h-16" />
      ))}
    </div>
  );
}
