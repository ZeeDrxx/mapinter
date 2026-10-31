import type { Metadata } from "next";
import { EventForm } from "./event-form";

export const metadata: Metadata = { title: "Nouvel event" };

export default function NewEventPage() {
  return (
    <div className="page flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Nouvel event</h1>
      <EventForm />
    </div>
  );
}
