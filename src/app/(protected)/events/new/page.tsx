"use client";

// Requirements: EVT-0002 AC1, AC4
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { RequireRole } from "@/components/auth/RequireRole";
import { AdminOnlyNotice } from "@/components/auth/AdminOnlyNotice";
import { EventForm } from "../EventForm";
import { useCreateEventMutation } from "@/lib/api/events.hooks";
import type { CreateEventInput, Event, UpdateEventInput } from "@/lib/api/events.types";

export default function NewEventPage() {
  const router = useRouter();
  const createEventMutation = useCreateEventMutation();

  async function handleCreate(input: CreateEventInput | UpdateEventInput): Promise<Event> {
    // EventForm always submits a full CreateEventInput shape in create
    // mode (name + starts_at are unconditionally included) — the prop's
    // wider union type exists to let the same component serve edit mode.
    // Returns the created Event (not void) so EventForm can hand its id
    // straight to the "capture a contact" section in the same submit;
    // navigation happens via onSaved instead, once that's also done.
    return await createEventMutation.mutateAsync(input as CreateEventInput);
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-12">
      <Link
        href="/events"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline"
      >
        <ArrowLeft className="size-4" />
        Back to Events
      </Link>
      <h1 className="mb-6 text-2xl font-bold tracking-tight">New Event</h1>
      <RequireRole allow="admin" fallback={<AdminOnlyNotice />}>
        <EventForm mode="create" onSubmit={handleCreate} onSaved={() => router.push("/events")} />
      </RequireRole>
    </main>
  );
}
