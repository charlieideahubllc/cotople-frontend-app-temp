// Requirements: API-0001 AC1, AC2
// Single typed module for all /api/v1/events calls, built on the shared
// apiClient axios instance. When the backend's real OpenAPI contract lands
// in this repo, this is the one file that needs to change (or be replaced
// by a generated client) — no other event UI code should call axios/fetch
// directly.
import { apiClient } from "./axiosClient";
import { withApiError } from "./api-error";
import type { CreateEventInput, Event, UpdateEventInput } from "./events.types";

export class EventsApiError extends Error {
  code: string;
  details?: unknown;
  correlationId?: string;

  constructor(code: string, message: string, details?: unknown, correlationId?: string) {
    super(message);
    this.name = "EventsApiError";
    this.code = code;
    this.details = details;
    this.correlationId = correlationId;
  }
}

function withEventsApiError<T>(request: () => Promise<T>): Promise<T> {
  return withApiError(EventsApiError, request);
}

// EVT-0003 AC1: GET /api/v1/events is paginated — the backend returns
// { items, total, limit, offset }, not a bare array.
export interface EventListResult {
  items: Event[];
  total: number;
  limit: number;
  offset: number;
}

export interface ListEventsParams {
  limit?: number;
  offset?: number;
  // Narrows to events owned by this profile. Per SRS §8.3, `profiles.id` is
  // both the PK and the FK to the Supabase Auth user, so this is the same
  // UUID as the signed-in user's `session.user.id` — no separate profile
  // lookup is needed to filter to "my events".
  ownerId?: string;
}

export function listEvents(params: ListEventsParams = {}): Promise<EventListResult> {
  return withEventsApiError(async () => {
    const { data } = await apiClient.get<EventListResult>("/api/v1/events", {
      params: { limit: params.limit, offset: params.offset, owner_id: params.ownerId },
    });
    return data;
  });
}

export function getEvent(id: string): Promise<Event> {
  return withEventsApiError(async () => {
    const { data } = await apiClient.get<Event>(`/api/v1/events/${id}`);
    return data;
  });
}

export function createEvent(input: CreateEventInput): Promise<Event> {
  return withEventsApiError(async () => {
    const { data } = await apiClient.post<Event>("/api/v1/events", input);
    return data;
  });
}

export function updateEvent(id: string, input: UpdateEventInput): Promise<Event> {
  return withEventsApiError(async () => {
    const { data } = await apiClient.patch<Event>(`/api/v1/events/${id}`, input);
    return data;
  });
}

export function archiveEvent(id: string): Promise<Event> {
  return withEventsApiError(async () => {
    const { data } = await apiClient.post<Event>(`/api/v1/events/${id}/archive`);
    return data;
  });
}
