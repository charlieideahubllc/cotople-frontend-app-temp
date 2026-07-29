// Requirements: API-0001 AC1, AC2
// Shared envelope-parsing logic for typed API modules (events.ts, contacts.ts,
// images.ts). Parses the SRS §9.3 error envelope on a non-OK axios response,
// re-throws SessionExpiredError unwrapped (already handled by the apiClient
// interceptor), and otherwise wraps the failure as the caller-supplied typed
// error class. Extracted from events.ts's original inline
// withEventsApiError once a second and third module needed the same logic
// (.kiro/specs/capture-manual-forms/design.md Decisions).
import { isAxiosError } from "axios";
import { SessionExpiredError } from "./axiosClient";

// SRS §9.3 error envelope shape.
interface ErrorEnvelope {
  success: false;
  code?: string;
  message?: string;
  details?: unknown;
  correlation_id?: string;
}

export interface ApiErrorLike extends Error {
  code: string;
  details?: unknown;
  correlationId?: string;
}

export interface ApiErrorConstructor<T extends ApiErrorLike> {
  new (code: string, message: string, details?: unknown, correlationId?: string): T;
}

export async function withApiError<T, E extends ApiErrorLike>(
  ErrorCtor: ApiErrorConstructor<E>,
  request: () => Promise<T>,
): Promise<T> {
  try {
    return await request();
  } catch (err) {
    // SessionExpiredError is already handled (message + redirect) by the
    // apiClient interceptor — propagate it unwrapped, not as ErrorCtor.
    if (err instanceof SessionExpiredError) {
      throw err;
    }
    if (isAxiosError(err)) {
      const envelope = err.response?.data as ErrorEnvelope | undefined;
      throw new ErrorCtor(
        envelope?.code ?? "UNKNOWN_ERROR",
        envelope?.message ?? `Request failed with status ${err.response?.status ?? "unknown"}`,
        envelope?.details,
        envelope?.correlation_id,
      );
    }
    throw err;
  }
}
