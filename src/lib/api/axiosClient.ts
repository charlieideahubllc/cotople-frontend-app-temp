// Requirements: AUTH-0004 AC1, AC2; API-0001 AC1, AC2
// Shared authenticated axios instance for the backend API. Client-only —
// attaches the current Supabase session's access token and centralizes
// 401 (expired/invalid session) handling so individual features don't
// each reimplement it. Mirrors the contract client.ts's apiFetch()
// previously provided, on top of axios instead of fetch.
import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
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

export const apiClient = axios.create();

apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  config.baseURL = getApiBaseUrl();
  if (session?.access_token) {
    config.headers.set("Authorization", `Bearer ${session.access_token}`);
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      handleSessionExpired();
      return Promise.reject(new SessionExpiredError());
    }
    return Promise.reject(error);
  },
);
