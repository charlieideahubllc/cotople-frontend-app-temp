// Requirement: AUTH-0005 AC1
// Mirrors the `profiles` table shape owned by contact-capture-backend (MVP SRS §8.3).
// This repo does not own or migrate this schema; it only types the shape it reads
// from the backend's /api/v1/me endpoint.
export type ProfileRole = "admin" | "staff";

export interface Profile {
  id: string;
  role: ProfileRole;
  display_name: string;
  is_active: boolean;
}
