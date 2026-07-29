"use client";

// Requirements: EVT-0002 AC2, AC3, AC4; EVT-0004 AC1
import { ArrowLeft } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RequireRole } from "@/components/auth/RequireRole";
import { AdminOnlyNotice } from "@/components/auth/AdminOnlyNotice";
import { EventForm } from "../../EventForm";
import {
  useArchiveEventMutation,
  useEventQuery,
  useUpdateEventMutation,
} from "@/lib/api/events.hooks";
import type { CreateEventInput, Event, UpdateEventInput } from "@/lib/api/events.types";

export default function EditEventPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: event, status, error } = useEventQuery(params.id);
  const updateEventMutation = useUpdateEventMutation(params.id);
  const archiveEventMutation = useArchiveEventMutation(params.id);

  async function handleUpdate(input: CreateEventInput | UpdateEventInput): Promise<Event> {
    return await updateEventMutation.mutateAsync(input);
  }

  // EVT-0002 AC3: archiving is a distinct action from the form's save,
  // calling the dedicated archive endpoint rather than a PATCH field.
  async function handleArchive() {
    await archiveEventMutation.mutateAsync();
    router.push("/events");
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <button
        type="button"
        onClick={() => router.back()}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline"
      >
        <ArrowLeft className="size-4" />
        Back to Event
      </button>
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Edit Event</h1>
      <RequireRole allow="admin" fallback={<AdminOnlyNotice />}>
        {status === "pending" && <p className="text-muted-foreground">Loading event...</p>}

        {status === "error" && (
          <p role="alert" className="text-sm text-destructive">
            {error instanceof Error ? error.message : "Something went wrong."}
          </p>
        )}

        {status === "success" && (
          <div className="space-y-6">
            <EventForm
              mode="edit"
              initialEvent={event}
              onSubmit={handleUpdate}
              onSaved={() => router.push("/events")}
            />
            <div className="space-y-2 border-t border-border pt-4">
              <Button
                variant="destructive"
                onClick={handleArchive}
                disabled={archiveEventMutation.isPending}
              >
                {archiveEventMutation.isPending ? "Archiving..." : "Archive Event"}
              </Button>
              {archiveEventMutation.isError && (
                <p role="alert" className="text-sm text-destructive">
                  {archiveEventMutation.error instanceof Error
                    ? archiveEventMutation.error.message
                    : "Something went wrong."}
                </p>
              )}
            </div>
          </div>
        )}
      </RequireRole>
    </main>
  );
}
