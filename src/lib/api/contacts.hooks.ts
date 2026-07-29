// Requirements: CAP-0001 AC2, AC3
// React Query wrappers around contacts.ts — the only place capture UI code
// should reach for TanStack Query's loading/error state instead of
// hand-rolled useState/useEffect, mirroring events.hooks.ts's pattern.
// Both calls are mutations (resolve is a validate-only POST, not a cached
// GET), so neither needs a query key or cache invalidation.
import { useMutation, useQuery } from "@tanstack/react-query";
import { createEventContact, listEventContacts, resolveContact } from "./contacts";
import type { ContactInput, ResolveInput } from "./contacts.types";

// Not event-scoped (Task 7 real-backend verification — resolveContact takes
// no eventId; see contacts.ts).
export function useResolveContactMutation() {
  return useMutation({
    mutationFn: (input: ResolveInput) => resolveContact(input),
  });
}

// eventId is supplied per-call, not at hook-construction time — in the
// merged event+contact submit flow (EventForm), a brand-new event's id is
// only known synchronously inside the submit handler itself, one render
// before it could arrive back down as a prop. Taking it as a mutate-time
// argument avoids that render-timing race entirely.
export function useCreateContactMutation() {
  return useMutation({
    mutationFn: ({
      eventId,
      input,
      idempotencyKey,
    }: {
      eventId: string;
      input: ContactInput;
      idempotencyKey: string;
    }) => createEventContact(eventId, input, idempotencyKey),
  });
}

// Stopgap event-detail contact list — see listEventContacts's own comment
// in contacts.ts for why this is an O(n) client-side filter rather than a
// single event-scoped request.
export function useEventContactsQuery(eventId: string) {
  return useQuery({
    queryKey: ["events", eventId, "contacts"],
    queryFn: () => listEventContacts(eventId),
  });
}
