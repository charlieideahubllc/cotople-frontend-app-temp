// Requirements: CAP-0001 AC2, AC3; CAP-0005 AC1; CAP-0008 AC1, AC2
// Single typed module for the manual-capture contacts calls, built on the
// shared apiClient axios instance. When the backend's real OpenAPI contract
// lands in this repo, this is the one file that needs to change (or be
// replaced by a generated client) — no other capture UI code should call
// axios directly.
import { apiClient } from "./axiosClient";
import { withApiError } from "./api-error";
import type {
  Contact,
  ContactDetail,
  ContactInput,
  ContactListResult,
  CreateEventContactResult,
  Occurrence,
  ResolveInput,
  ResolveResult,
} from "./contacts.types";

export class ContactsApiError extends Error {
  code: string;
  details?: unknown;
  correlationId?: string;

  constructor(code: string, message: string, details?: unknown, correlationId?: string) {
    super(message);
    this.name = "ContactsApiError";
    this.code = code;
    this.details = details;
    this.correlationId = correlationId;
  }
}

function withContactsApiError<T>(request: () => Promise<T>): Promise<T> {
  return withApiError(ContactsApiError, request);
}

// CAP-0001 AC2: validate and return a duplicate decision without writing.
// Not event-scoped — the real ResolveRequest schema takes only phone/email
// (confirmed against the live backend's OpenAPI contract, Task 7).
export function resolveContact(input: ResolveInput): Promise<ResolveResult> {
  return withContactsApiError(async () => {
    const { data } = await apiClient.post<ResolveResult>("/api/v1/contacts/resolve", input);
    return data;
  });
}

// CAP-0001 AC3, CAP-0005 AC1: create/update the contact and create a new
// event occurrence, carrying the client-generated idempotency key so a
// network retry of the same submission doesn't create a second occurrence.
export function createEventContact(
  eventId: string,
  input: ContactInput,
  idempotencyKey: string,
): Promise<CreateEventContactResult> {
  return withContactsApiError(async () => {
    const { data } = await apiClient.post<CreateEventContactResult>(
      `/api/v1/events/${eventId}/contacts`,
      input,
      { headers: { "Idempotency-Key": idempotencyKey } },
    );
    return data;
  });
}

// GET /api/v1/contacts — paginated, no event filter (real API contract).
export function listContacts(
  params: { limit?: number; offset?: number } = {},
): Promise<ContactListResult> {
  return withContactsApiError(async () => {
    const { data } = await apiClient.get<ContactListResult>("/api/v1/contacts", {
      params: { limit: params.limit, offset: params.offset },
    });
    return data;
  });
}

// GET /api/v1/contacts/{contact_id} — a contact plus its full occurrence
// history.
export function getContact(contactId: string): Promise<ContactDetail> {
  return withContactsApiError(async () => {
    const { data } = await apiClient.get<ContactDetail>(`/api/v1/contacts/${contactId}`);
    return data;
  });
}

const EVENT_CONTACTS_PAGE_SIZE = 200;

export interface ContactWithOccurrence {
  contact: Contact;
  occurrence: Occurrence;
}

// Stopgap for a per-event contact list: the real backend has no
// event-scoped "list contacts for event X" endpoint (confirmed against the
// live OpenAPI contract — GET /api/v1/contacts takes only limit/offset).
// Fetches every contact (paginated) then every contact's occurrence
// history, keeping only occurrences that match this event. This is O(n)
// individual detail requests on top of the paginated list — acceptable for
// pilot-sized data, not something that should be left as-is once a real
// event-scoped endpoint exists.
export async function listEventContacts(eventId: string): Promise<ContactWithOccurrence[]> {
  const allContacts: Contact[] = [];
  let offset = 0;
  for (;;) {
    const page = await listContacts({ limit: EVENT_CONTACTS_PAGE_SIZE, offset });
    allContacts.push(...page.items);
    offset += EVENT_CONTACTS_PAGE_SIZE;
    if (page.items.length === 0 || offset >= page.total) {
      break;
    }
  }

  const details = await Promise.all(allContacts.map((c) => getContact(c.id)));

  const results: ContactWithOccurrence[] = [];
  for (const detail of details) {
    for (const occurrence of detail.occurrences) {
      if (occurrence.event_id === eventId) {
        results.push({ contact: detail, occurrence });
      }
    }
  }

  results.sort((a, b) => b.occurrence.captured_at.localeCompare(a.occurrence.captured_at));
  return results;
}
