// Requirement: API-0001 AC3 (CAP-0008 AC3)
// Verified against the real contact-backend-api's generated OpenAPI schema
// (Task 7 manual verification, 2026-07-28). The request has no `event_id`
// (upload isn't event-scoped — an image is linked to an event only later,
// via the capture/confirm endpoints) and requires `size_bytes`; the
// response's `upload_url` already embeds `signed_token` as its `?token=`
// query param, confirmed by a real successful PUT during verification —
// `signed_token` is returned separately but doesn't need to be attached to
// the PUT by the client.
export interface UploadUrlResult {
  image_id: string;
  upload_url: string; // signed Supabase Storage PUT target (token embedded)
  object_path: string;
  signed_token: string;
}

// Requirements: EIF-0001 AC3; EIF-0003 AC1, AC3
// POST /api/v1/images/{image_id}/extract response (ReviewPayload, per
// API_REFERENCE.md's Images section). `fields` only ever contains the keys
// extraction actually found — absent keys mean "nothing to autofill for
// this field", not an empty/null value (event-image-form/design.md).
export type ExtractableFieldName =
  | "first_name"
  | "last_name"
  | "company"
  | "position"
  | "phone"
  | "email"
  | "website"
  | "address";

export interface ExtractedField {
  value: string;
  source: "qr" | "ai";
}

export interface ReviewPayload {
  image_id: string;
  fields: Partial<Record<ExtractableFieldName, ExtractedField>>;
  warnings: string[];
  capture_method: "image" | "qr" | "mixed";
  extraction_status: "completed" | "failed" | "skipped";
}

// POST /api/v1/images/{image_id}/confirm request (ConfirmRequest). The
// response reuses contacts.types.ts's CreateEventContactResult, per
// API_REFERENCE.md's "same shape as contacts capture" note — not
// redefined here.
export interface ConfirmRequest {
  event_id: string;
  capture_method: "image" | "qr" | "mixed";
  first_name: string;
  last_name: string;
  company?: string;
  position?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  notes?: string;
  selfie_id?: string;
}
