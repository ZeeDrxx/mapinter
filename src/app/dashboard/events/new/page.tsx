import type { Metadata } from "next";
import Link from "next/link";
import { EventForm } from "./event-form";

export const metadata: Metadata = { title: "Nouvel event" };

export default function NewEventPage() {
  return (
    <div className="page flex flex-col gap-10">
      <div>
        <Link href="/dashboard" className="btn btn-ghost btn-sm -ml-3">
          ← Mes events
        </Link>
        <h1 className="h1 mt-3">Nouvel event</h1>
      </div>
      <EventForm />
    </div>
  );
}
