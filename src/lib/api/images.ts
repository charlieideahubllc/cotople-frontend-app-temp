// Requirements: CAP-0006 AC3, AC5, AC6; CAP-0007 AC1, AC2
// Single typed module for business-card image upload. requestUploadUrl goes
// through the shared apiClient (a real backend API call, needs auth).
// uploadImageToStorage deliberately does NOT use apiClient — the signed URL
// it PUTs to is itself the credential for that one upload; attaching the
// app's Supabase bearer token or running it through the 401 interceptor
// would be incorrect (.kiro/specs/capture-manual-forms/design.md Decisions).
import axios from "axios";
import { apiClient } from "./axiosClient";
import { withApiError } from "./api-error";
import type { CreateEventContactResult } from "./contacts.types";
import type { ConfirmRequest, ReviewPayload, UploadUrlResult } from "./images.types";

export class ImagesApiError extends Error {
  code: string;
  details?: unknown;
  correlationId?: string;

  constructor(code: string, message: string, details?: unknown, correlationId?: string) {
    super(message);
    this.name = "ImagesApiError";
    this.code = code;
    this.details = details;
    this.correlationId = correlationId;
  }
}

// CAP-0006 AC3: obtain a signed Supabase Storage upload target — the image
// is never proxied through the backend/Vercel function body. Not
// event-scoped and requires size_bytes (real UploadUrlRequest schema,
// confirmed against the live backend — Task 7).
export function requestUploadUrl(
  contentType: "image/jpeg" | "image/png",
  sizeBytes: number,
): Promise<UploadUrlResult> {
  return withApiError(ImagesApiError, async () => {
    const { data } = await apiClient.post<UploadUrlResult>("/api/v1/images/upload-url", {
      content_type: contentType,
      size_bytes: sizeBytes,
    });
    return data;
  });
}

// EIF-0001 AC1: run OCR/QR extraction against an already-uploaded image.
// Nothing is persisted server-side by this call (API_REFERENCE.md).
export function extractImage(imageId: string): Promise<ReviewPayload> {
  return withApiError(ImagesApiError, async () => {
    const { data } = await apiClient.post<ReviewPayload>(`/api/v1/images/${imageId}/extract`);
    return data;
  });
}

// EIF-0003 AC1, AC3: persists the contact via the same ContactCapture
// pipeline as manual entry, linking it back to the source image. Sends an
// Idempotency-Key header on the same precedent as contacts.ts's
// createEventContact (event-image-form/design.md Decisions) — not
// documented for this endpoint in API_REFERENCE.md, so this is flagged for
// real-backend verification (tasks.md Task 7.2), not a confirmed contract.
export function confirmImage(
  imageId: string,
  input: ConfirmRequest,
  idempotencyKey: string,
): Promise<CreateEventContactResult> {
  return withApiError(ImagesApiError, async () => {
    const { data } = await apiClient.post<CreateEventContactResult>(
      `/api/v1/images/${imageId}/confirm`,
      input,
      { headers: { "Idempotency-Key": idempotencyKey } },
    );
    return data;
  });
}

export interface UploadImageOptions {
  signal?: AbortSignal;
  onProgress?: (percent: number) => void;
}

// CAP-0006 AC3-AC5, CAP-0007 AC1-AC2: direct PUT to the signed URL, with
// upload-progress reporting and cancellation support. Failures here are not
// the SRS §9.3 API error envelope (Supabase Storage's own error format) —
// callers show a generic upload-failure state, not a parsed ContactsApiError
// style message (design.md Error Handling table).
export async function uploadImageToStorage(
  uploadUrl: string,
  file: File,
  opts: UploadImageOptions = {},
): Promise<void> {
  await axios.put(uploadUrl, file, {
    headers: { "Content-Type": file.type },
    signal: opts.signal,
    onUploadProgress: (event) => {
      if (!opts.onProgress) {
        return;
      }
      const total = event.total ?? file.size;
      const percent = total > 0 ? Math.round((event.loaded / total) * 100) : 0;
      opts.onProgress(percent);
    },
  });
}
