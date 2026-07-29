// Requirement: EIF-0005 AC2, AC3, AC4
// Single typed module for GET /api/v1/event-occurrences — the only endpoint
// that returns business_card_image_url/selfie_image_url. Not Admin-only
// (API_REFERENCE.md: list endpoints in this backend aren't role-restricted
// the way mutating Event endpoints are).
import { apiClient } from "./axiosClient";
import { withApiError } from "./api-error";
import type { EventOccurrenceListResult } from "./event-occurrences.types";

export class EventOccurrencesApiError extends Error {
  code: string;
  details?: unknown;
  correlationId?: string;

  constructor(code: string, message: string, details?: unknown, correlationId?: string) {
    super(message);
    this.name = "EventOccurrencesApiError";
    this.code = code;
    this.details = details;
    this.correlationId = correlationId;
  }
}

export interface ListEventOccurrencesParams {
  eventId?: string;
  contactId?: string;
  sortBy?: "captured_at";
  sortOrder?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

export function listEventOccurrences(
  params: ListEventOccurrencesParams = {},
): Promise<EventOccurrenceListResult> {
  return withApiError(EventOccurrencesApiError, async () => {
    const { data } = await apiClient.get<EventOccurrenceListResult>("/api/v1/event-occurrences", {
      params: {
        event_id: params.eventId,
        contact_id: params.contactId,
        sort_by: params.sortBy,
        sort_order: params.sortOrder,
        limit: params.limit,
        offset: params.offset,
      },
    });
    return data;
  });
}
