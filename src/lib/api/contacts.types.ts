// Requirement: API-0001 AC3 (CAP-0008 AC3)
// Verified against the real contact-backend-api's generated OpenAPI schema
// and live requests during capture-manual-forms Task 7 manual verification
// (2026-07-28, local contact-backend-api + local Supabase — see
// exit-validation.md). This replaced an earlier, incorrect set of
// assumptions (`resolution`/`matched_contact`/`ambiguous`/`sync_status`
// field names, and a mistaken `event_id` in the resolve/upload-url request
// bodies) that this same comment used to document as an accepted risk —
// the real contract is now confirmed, not assumed.
export interface ContactInput {
  first_name: string;
  last_name: string;
  company?: string;
  position?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  notes?: string; // occurrence notes (SRS §5.3 fields table)
}

// POST /api/v1/contacts/resolve only checks phone/email — it is not scoped
// to an event and takes no other contact fields (real `ResolveRequest`
// schema).
export interface ResolveInput {
  phone?: string;
  email?: string;
}

export type ResolveMatch = "no_match" | "phone_match" | "email_match" | "ambiguous";

export interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  company: string | null;
  position: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  created_at: string;
  updated_at: string;
}

// Real `ResolveResult` schema: no `event_id` sent or returned, no separate
// `ambiguous` boolean — "ambiguous" is one of `match`'s four enum values.
export interface ResolveResult {
  match: ResolveMatch;
  contact: Contact | null;
  reason: string | null;
}

export interface Occurrence {
  id: string;
  event_id: string;
  contact_id: string;
  captured_by_profile_id: string;
  captured_at: string;
  capture_method: "manual" | "image" | "qr" | "mixed";
  notes: string | null;
  contact_image_id: string | null;
  duplicate_resolution: string;
  ghl_sync_status: "pending" | "synced" | "failed";
}

// Real `ContactCaptureResult` schema: a full nested `occurrence` object
// (not just an id), and the HighLevel sync status lives on the occurrence
// (`ghl_sync_status`), not as a top-level `sync_status` field.
export interface CreateEventContactResult {
  contact: Contact;
  occurrence: Occurrence;
  duplicate_resolution: string;
  pending_review_fields: string[];
}

// GET /api/v1/contacts response (real `ContactListOut` schema).
export interface ContactListResult {
  items: Contact[];
  total: number;
  limit: number;
  offset: number;
}

// GET /api/v1/contacts/{contact_id} response (real `ContactDetailOut`
// schema) — a contact plus its full occurrence history. There is no
// event-scoped "list contacts for event X" endpoint; per-event contact
// lists (`listEventContacts` in contacts.ts) are built by fetching every
// contact's detail and filtering occurrences client-side, a stopgap until
// the backend adds a real event-scoped endpoint.
export interface ContactDetail extends Contact {
  occurrences: Occurrence[];
}
