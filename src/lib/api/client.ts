// Requirements: AUTH-0004 AC1, AC2
// Shared authenticated-fetch wrapper for the backend API. Client-only —
// attaches the current Supabase session's access token and centralizes
// 401 (expired/invalid session) handling so individual features don't
// each reimplement it.
import { createClient } from "@/lib/supabase/client";
import { handleSessionExpired } from "./session-expired";

export class SessionExpiredError extends Error {
  constructor() {
    super("Session expired");
    this.name = "SessionExpiredError";
  }
}

function getApiBaseUrl(): string {
  const value = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!value) {
    throw new Error(
      "Missing required environment variable: NEXT_PUBLIC_API_BASE_URL. Copy .env.example to .env.local and fill in real values.",
    );
  }
  return value;
}

// path must be a backend-relative path, e.g. "/api/v1/me" — never a full URL,
// so every call is guaranteed to go through the configured API base.
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = new Headers(init.headers);
  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers,
  });

  if (response.status === 401) {
    handleSessionExpired();
    throw new SessionExpiredError();
  }

  return response;
}
