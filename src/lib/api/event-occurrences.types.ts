// Requirement: EIF-0005 AC2, AC3, AC4
// GET /api/v1/event-occurrences response (EventOccurrenceListOut), per
// API_REFERENCE.md's Event Contacts section. Extends the existing
// Occurrence shape (contacts.types.ts) with the two signed-URL fields that
// endpoint alone returns — business_card_image_url/selfie_image_url are
// never returned by /api/v1/contacts or /api/v1/contacts/{id}.
import type { Occurrence } from "./contacts.types";

export interface EventOccurrenceItem extends Occurrence {
  // Short-lived signed URL (Supabase Storage or, for the local-storage
  // fallback, a GET /api/v1/images/local-download/{token} URL) — null when
  // contact_image_id is unset, never an error (API_REFERENCE.md).
  business_card_image_url: string | null;
  selfie_image_url: string | null;
}

export interface EventOccurrenceListResult {
  items: EventOccurrenceItem[];
  total: number;
  limit: number;
  offset: number;
}
