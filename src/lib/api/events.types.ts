// Requirement: API-0001 AC3
// Mirrors the `events` table owned by contact-backend-api (MVP SRS §8.3) and
// the field rules in SRS §5.2. No generated OpenAPI contract exists in this
// repo yet — this is the single place to update if the real shape differs.
export type EventStatus = "active" | "archived";

export interface Event {
  id: string;
  name: string;
  starts_at: string; // ISO 8601, UTC
  location: string | null;
  notes: string | null;
  status: EventStatus;
  owner_profile_id: string;
  created_at: string;
  updated_at: string;
}

export interface CreateEventInput {
  name: string;
  starts_at: string; // ISO 8601, UTC
  location?: string;
  notes?: string;
}

export type UpdateEventInput = Partial<CreateEventInput>;
