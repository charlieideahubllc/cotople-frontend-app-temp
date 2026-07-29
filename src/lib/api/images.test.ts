import { describe, it, expect, vi, beforeEach } from "vitest";
import { AxiosError, AxiosHeaders } from "axios";

const { apiClientMock, SessionExpiredErrorStub, putMock } = vi.hoisted(() => {
  class SessionExpiredErrorStub extends Error {}
  return {
    apiClientMock: { post: vi.fn() },
    SessionExpiredErrorStub,
    putMock: vi.fn(),
  };
});

vi.mock("./axiosClient", () => ({
  apiClient: apiClientMock,
  SessionExpiredError: SessionExpiredErrorStub,
}));

// Only ./axiosClient's apiClient is mocked above (used by requestUploadUrl,
// which goes through the shared authenticated client). uploadImageToStorage
// deliberately calls the raw `axios` module's `put` directly (design.md
// Decisions — no apiClient, no bearer token) so it needs its own mock here,
// keeping every other real export (isAxiosError, AxiosError, AxiosHeaders)
// intact for api-error.ts and this file's own axiosError() helper.
vi.mock("axios", async (importOriginal) => {
  const actual = await importOriginal<typeof import("axios")>();
  return {
    ...actual,
    default: { ...actual.default, put: putMock },
  };
});

import { confirmImage, extractImage, requestUploadUrl, uploadImageToStorage, ImagesApiError } from "./images";
import type { ConfirmRequest, ReviewPayload, UploadUrlResult } from "./images.types";
import type { CreateEventContactResult } from "./contacts.types";

const sampleUploadTarget: UploadUrlResult = {
  image_id: "img-1",
  upload_url: "https://storage.example.com/signed-put-url?token=abc",
  object_path: "events/e1/cards/img-1.jpg",
  signed_token: "abc",
};

beforeEach(() => {
  apiClientMock.post.mockReset();
  putMock.mockReset();
});

function axiosError(status: number, body?: unknown) {
  const error = new AxiosError("Request failed", String(status));
  error.response = {
    data: body,
    status,
    statusText: "",
    headers: {},
    config: { headers: new AxiosHeaders() },
  };
  return error;
}

function makeFile(name = "card.jpg", type = "image/jpeg", sizeBytes = 1024): File {
  return new File([new Uint8Array(sizeBytes)], name, { type });
}

// Requirement: CAP-0006 AC3, AC5, AC6; CAP-0007 AC1, AC2
describe("images API module", () => {
  describe("requestUploadUrl", () => {
    it("POSTs content_type + size_bytes (no event_id — not event-scoped) and parses the signed upload target", async () => {
      apiClientMock.post.mockResolvedValue({ data: sampleUploadTarget });

      const result = await requestUploadUrl("image/jpeg", 1024);

      expect(result).toEqual(sampleUploadTarget);
      expect(apiClientMock.post).toHaveBeenCalledWith("/api/v1/images/upload-url", {
        content_type: "image/jpeg",
        size_bytes: 1024,
      });
    });

    it("throws ImagesApiError with the parsed envelope on a non-OK response", async () => {
      apiClientMock.post.mockRejectedValue(
        axiosError(400, { success: false, code: "VALIDATION_ERROR", message: "Bad content type" }),
      );

      await expect(requestUploadUrl("image/png", 1024)).rejects.toMatchObject({
        name: "ImagesApiError",
        code: "VALIDATION_ERROR",
      });
    });

    it("propagates SessionExpiredError unwrapped, not as ImagesApiError", async () => {
      apiClientMock.post.mockRejectedValue(new SessionExpiredErrorStub("expired"));

      await expect(requestUploadUrl("image/jpeg", 1024)).rejects.toBeInstanceOf(
        SessionExpiredErrorStub,
      );
      await expect(requestUploadUrl("image/jpeg", 1024)).rejects.not.toBeInstanceOf(
        ImagesApiError,
      );
    });
  });

  describe("extractImage", () => {
    it("POSTs to the extract route with no body and parses the review payload", async () => {
      const review: ReviewPayload = {
        image_id: "img-1",
        fields: {
          first_name: { value: "Ada", source: "ai" },
          email: { value: "ada@example.com", source: "qr" },
        },
        warnings: [],
        capture_method: "image",
        extraction_status: "completed",
      };
      apiClientMock.post.mockResolvedValue({ data: review });

      const result = await extractImage("img-1");

      expect(result).toEqual(review);
      expect(apiClientMock.post).toHaveBeenCalledWith("/api/v1/images/img-1/extract");
    });

    it("throws ImagesApiError with the parsed envelope on a non-OK response", async () => {
      apiClientMock.post.mockRejectedValue(
        axiosError(502, { success: false, code: "STORAGE_UNAVAILABLE", message: "Storage down" }),
      );

      await expect(extractImage("img-1")).rejects.toMatchObject({
        name: "ImagesApiError",
        code: "STORAGE_UNAVAILABLE",
      });
    });

    it("propagates SessionExpiredError unwrapped, not as ImagesApiError", async () => {
      apiClientMock.post.mockRejectedValue(new SessionExpiredErrorStub("expired"));

      await expect(extractImage("img-1")).rejects.toBeInstanceOf(SessionExpiredErrorStub);
      await expect(extractImage("img-1")).rejects.not.toBeInstanceOf(ImagesApiError);
    });
  });

  describe("confirmImage", () => {
    const confirmInput: ConfirmRequest = {
      event_id: "e1",
      capture_method: "image",
      first_name: "Ada",
      last_name: "Lovelace",
      phone: "+15551234567",
    };

    const confirmResult: CreateEventContactResult = {
      contact: {
        id: "c1",
        first_name: "Ada",
        last_name: "Lovelace",
        company: null,
        position: null,
        phone: "+15551234567",
        email: null,
        website: null,
        address: null,
        created_at: "2026-07-27T00:00:00.000Z",
        updated_at: "2026-07-27T00:00:00.000Z",
      },
      occurrence: {
        id: "occ-1",
        event_id: "e1",
        contact_id: "c1",
        captured_by_profile_id: "p1",
        captured_at: "2026-07-27T00:00:00.000Z",
        capture_method: "image",
        notes: null,
        contact_image_id: "img-1",
        duplicate_resolution: "new",
        ghl_sync_status: "pending",
      },
      duplicate_resolution: "new",
      pending_review_fields: [],
    };

    it("POSTs the confirm request with the Idempotency-Key header and parses the response", async () => {
      apiClientMock.post.mockResolvedValue({ data: confirmResult });

      const result = await confirmImage("img-1", confirmInput, "idem-key-123");

      expect(result).toEqual(confirmResult);
      expect(apiClientMock.post).toHaveBeenCalledWith(
        "/api/v1/images/img-1/confirm",
        confirmInput,
        { headers: { "Idempotency-Key": "idem-key-123" } },
      );
    });

    it("throws ImagesApiError with code AMBIGUOUS_DUPLICATE on a 409 conflict", async () => {
      apiClientMock.post.mockRejectedValue(
        axiosError(409, {
          success: false,
          code: "AMBIGUOUS_DUPLICATE",
          message: "Matches conflict",
        }),
      );

      await expect(confirmImage("img-1", confirmInput, "idem-key-123")).rejects.toMatchObject({
        name: "ImagesApiError",
        code: "AMBIGUOUS_DUPLICATE",
      });
    });

    it("propagates SessionExpiredError unwrapped, not as ImagesApiError", async () => {
      apiClientMock.post.mockRejectedValue(new SessionExpiredErrorStub("expired"));

      await expect(
        confirmImage("img-1", confirmInput, "idem-key-123"),
      ).rejects.toBeInstanceOf(SessionExpiredErrorStub);
    });
  });

  describe("uploadImageToStorage", () => {
    it("PUTs the file directly to the signed URL with its content type", async () => {
      putMock.mockResolvedValue({ status: 200 });
      const file = makeFile();

      await uploadImageToStorage(sampleUploadTarget.upload_url, file);

      expect(putMock).toHaveBeenCalledWith(
        sampleUploadTarget.upload_url,
        file,
        expect.objectContaining({ headers: { "Content-Type": "image/jpeg" } }),
      );
    });

    it("reports upload progress via onProgress", async () => {
      const file = makeFile("card.jpg", "image/jpeg", 1000);
      putMock.mockImplementation(async (_url, _data, config) => {
        config.onUploadProgress?.({ loaded: 500, total: 1000 });
        config.onUploadProgress?.({ loaded: 1000, total: 1000 });
        return { status: 200 };
      });
      const onProgress = vi.fn();

      await uploadImageToStorage(sampleUploadTarget.upload_url, file, { onProgress });

      expect(onProgress).toHaveBeenNthCalledWith(1, 50);
      expect(onProgress).toHaveBeenNthCalledWith(2, 100);
    });

    it("rejects with a generic failure, not a wrapped ImagesApiError, on a failed PUT", async () => {
      const uploadError = new Error("storage rejected the upload");
      putMock.mockRejectedValue(uploadError);

      await expect(uploadImageToStorage(sampleUploadTarget.upload_url, makeFile())).rejects.toBe(
        uploadError,
      );
    });

    it("rejects when the provided signal is already aborted", async () => {
      const controller = new AbortController();
      controller.abort();
      putMock.mockImplementation(async (_url, _data, config) => {
        if (config.signal?.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }
        return { status: 200 };
      });

      await expect(
        uploadImageToStorage(sampleUploadTarget.upload_url, makeFile(), {
          signal: controller.signal,
        }),
      ).rejects.toThrow("Aborted");
    });
  });
});
