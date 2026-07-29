// Requirements: API-0001 AC1, AC2
// React Query wrappers around events.ts — the only place event UI code
// should reach for TanStack Query's cache/loading/error state instead of
// hand-rolled useState/useEffect.
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { archiveEvent, createEvent, getEvent, listEvents, updateEvent } from "./events";
import type { CreateEventInput, UpdateEventInput } from "./events.types";

export const EVENTS_PAGE_SIZE = 10;

const eventsKey = ["events"] as const;
const eventsListKey = (page: number, ownerId?: string) =>
  [...eventsKey, "list", { page, ownerId }] as const;
const eventKey = (id: string) => ["events", id] as const;

// EVT-0003 AC1: 1-indexed page, translated to the backend's limit/offset.
// keepPreviousData avoids a loading flash when moving between pages —
// the previous page's rows stay on screen (dimmed by the caller) until the
// next page resolves.
//
// `ownerId` narrows to events owned by that profile (backend's `owner_id`
// query param) — pass the signed-in user's `session.user.id` for a
// "my events" filter, since `profiles.id` is the same UUID (SRS §8.3).
export function useEventsQuery(page: number, ownerId?: string) {
  return useQuery({
    queryKey: eventsListKey(page, ownerId),
    queryFn: () =>
      listEvents({ limit: EVENTS_PAGE_SIZE, offset: (page - 1) * EVENTS_PAGE_SIZE, ownerId }),
    placeholderData: keepPreviousData,
  });
}

export function useEventQuery(id: string) {
  return useQuery({ queryKey: eventKey(id), queryFn: () => getEvent(id) });
}

export function useCreateEventMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateEventInput) => createEvent(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: eventsKey });
    },
  });
}

export function useUpdateEventMutation(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateEventInput) => updateEvent(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: eventsKey });
      queryClient.invalidateQueries({ queryKey: eventKey(id) });
    },
  });
}

export function useArchiveEventMutation(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => archiveEvent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: eventsKey });
      queryClient.invalidateQueries({ queryKey: eventKey(id) });
    },
  });
}
