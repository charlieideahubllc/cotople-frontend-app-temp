"use client";

// Event detail screen: event header info plus the contacts captured at
// this event. There is no real event-scoped "list contacts for event X"
// endpoint yet (confirmed against the live backend's OpenAPI contract) —
// useEventContactsQuery is a client-side stopgap (fetches every contact,
// filters occurrences by event id) documented in contacts.ts/contacts.hooks.ts.
// It will not scale past pilot-sized data; replace once a real endpoint
// exists.
import Link from "next/link";
import { ArrowLeft, ImageIcon, Pencil } from "lucide-react";
import { useParams } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RequireRole } from "@/components/auth/RequireRole";
import { useEventContactsQuery } from "@/lib/api/contacts.hooks";
import { useEventQuery } from "@/lib/api/events.hooks";
import { useEventOccurrencesQuery } from "@/lib/api/event-occurrences.hooks";
import type { Occurrence } from "@/lib/api/contacts.types";

function captureMethodLabel(method: Occurrence["capture_method"]): string {
  switch (method) {
    case "manual":
      return "Manual entry";
    case "image":
      return "Business card scan";
    case "qr":
      return "QR / vCard";
    case "mixed":
      return "Mixed";
  }
}

export default function EventDetailPage() {
  const params = useParams<{ id: string }>();
  const eventQuery = useEventQuery(params.id);
  const contactsQuery = useEventContactsQuery(params.id);
  // EIF-0005: the only source of business_card_image_url — /api/v1/contacts
  // and /api/v1/contacts/{id} (used by useEventContactsQuery above) never
  // return it.
  const occurrencesQuery = useEventOccurrencesQuery(params.id);
  const imageUrlByOccurrenceId = new Map(
    (occurrencesQuery.data ?? []).map((item) => [item.id, item.business_card_image_url]),
  );

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-12">
      <Link
        href="/events"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline"
      >
        <ArrowLeft className="size-4" />
        Back to Events
      </Link>

      {eventQuery.status === "pending" && <Skeleton className="h-9 w-64" />}

      {eventQuery.status === "error" && (
        <Alert variant="destructive">
          <AlertDescription>
            {eventQuery.error instanceof Error ? eventQuery.error.message : "Something went wrong."}
          </AlertDescription>
        </Alert>
      )}

      {eventQuery.status === "success" && (
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{eventQuery.data.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {new Date(eventQuery.data.starts_at).toLocaleString()}
              {eventQuery.data.location ? ` · ${eventQuery.data.location}` : ""}
            </p>
            {eventQuery.data.notes && (
              <p className="mt-2 max-w-2xl whitespace-pre-wrap text-sm text-muted-foreground">
                {eventQuery.data.notes}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <RequireRole allow="admin">
              <Button
                variant="outline"
                render={<Link href={`/events/${params.id}/edit`} />}
                nativeButton={false}
              >
                <Pencil className="size-4" />
                Edit
              </Button>
            </RequireRole>
            <Button
              className="!text-white"
              render={<Link href={`/events/${params.id}/capture`} />}
              nativeButton={false}
            >
              Capture Contact
            </Button>
          </div>
        </div>
      )}

      <h2 className="mb-3 text-lg font-semibold tracking-tight">Contacts</h2>

      {contactsQuery.status === "pending" && (
        <div className="space-y-2">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      )}

      {contactsQuery.status === "error" && (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>
              {contactsQuery.error instanceof Error
                ? contactsQuery.error.message
                : "Something went wrong."}
            </span>
            <Button variant="outline" size="sm" onClick={() => contactsQuery.refetch()}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {contactsQuery.status === "success" && contactsQuery.data.length === 0 && (
        <p className="text-muted-foreground">No contacts captured at this event yet.</p>
      )}

      {contactsQuery.status === "success" && contactsQuery.data.length > 0 && (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {contactsQuery.data.map(({ contact, occurrence }) => (
            <li
              key={occurrence.id}
              className="flex min-w-0 flex-col gap-3 rounded-lg border border-border p-3"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {contact.first_name} {contact.last_name}
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {[contact.position, contact.company].filter(Boolean).join(" at ") || "—"}
                </p>
                <p className="mt-1 truncate text-sm text-muted-foreground">
                  {contact.phone ?? contact.email ?? "No phone or email on file"}
                </p>
              </div>
              <div className="mt-auto flex items-center justify-between gap-2">
                <Badge variant="outline">{captureMethodLabel(occurrence.capture_method)}</Badge>
                <p className="text-xs text-muted-foreground">
                  {new Date(occurrence.captured_at).toLocaleString()}
                </p>
              </div>
              {occurrence.contact_image_id && (() => {
                // EIF-0005 AC2: render the URL exactly as the backend
                // returned it (Supabase-signed or local-download-signed —
                // API_REFERENCE.md's local-download token IS the access
                // control) with no bearer token attached. EIF-0005 AC3:
                // null (not yet loaded, or genuinely unset) falls back to
                // the existing no-preview indicator rather than an error.
                const imageUrl = imageUrlByOccurrenceId.get(occurrence.id);
                if (imageUrl) {
                  return (
                    // eslint-disable-next-line @next/next/no-img-element -- a short-lived signed URL isn't a stable asset Next's image optimizer should cache/rewrite.
                    <img
                      src={imageUrl}
                      alt={`Business card for ${contact.first_name} ${contact.last_name}`}
                      className="h-40 w-full rounded-md border border-border object-cover"
                    />
                  );
                }
                return (
                  <div
                    className="flex h-40 w-full items-center justify-center gap-1.5 rounded-md border border-border bg-muted/30 text-sm text-muted-foreground"
                    title="No image preview is available for this capture."
                  >
                    <ImageIcon className="size-4" aria-hidden="true" />
                    Image on file
                  </div>
                );
              })()}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
