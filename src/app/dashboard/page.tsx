import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { formatEventDates, listMyEvents } from "@/lib/events";
import { StatusBadge } from "@/components/status-badge";

export const metadata: Metadata = { title: "Mes events" };

export default function DashboardPage() {
  return (
    <div className="page flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mes events</h1>
        <Link href="/dashboard/events/new" className="btn-primary">
          + Nouvel event
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
      <div className="card flex flex-col items-center gap-3 py-12 text-center">
        <p className="font-medium">Aucun event pour l&apos;instant</p>
        <p className="text-sm text-zinc-500">
          Commencez par délimiter le lieu de votre premier event sur la carte.
        </p>
        <Link href="/dashboard/events/new" className="btn-primary mt-2">
          Créer un event
        </Link>
      </div>
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {events.map((e) => (
        <li key={e.id}>
          <Link href={`/dashboard/events/${e.id}`} className="card block transition-colors hover:border-blue-400">
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-semibold">{e.name}</h2>
              <StatusBadge published={e.is_published} />
            </div>
            <p className="mt-1 font-mono text-xs text-zinc-500">/{e.slug}</p>
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
              {formatEventDates(e.starts_at, e.ends_at)}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function EventListSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="card h-28 animate-pulse" />
      ))}
    </div>
  );
}
