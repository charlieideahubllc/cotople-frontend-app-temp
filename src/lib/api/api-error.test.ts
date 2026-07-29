import { describe, it, expect } from "vitest";
import { AxiosError, AxiosHeaders } from "axios";
import { withApiError } from "./api-error";
import { SessionExpiredError } from "./axiosClient";

class TestApiError extends Error {
  code: string;
  details?: unknown;
  correlationId?: string;

  constructor(code: string, message: string, details?: unknown, correlationId?: string) {
    super(message);
    this.name = "TestApiError";
    this.code = code;
    this.details = details;
    this.correlationId = correlationId;
  }
}

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

// Requirement: API-0001 AC1, AC2
describe("withApiError", () => {
  it("resolves with the request's value on success", async () => {
    const result = await withApiError(TestApiError, async () => "ok");
    expect(result).toBe("ok");
  });

  it("throws the given error class with the parsed envelope on a non-OK response", async () => {
    await expect(
      withApiError(TestApiError, () =>
        Promise.reject(
          axiosError(400, {
            success: false,
            code: "VALIDATION_ERROR",
            message: "Invalid input",
            details: [{ field: "email", message: "Enter a valid email address." }],
            correlation_id: "corr-1",
          }),
        ),
      ),
    ).rejects.toMatchObject({
      name: "TestApiError",
      code: "VALIDATION_ERROR",
      message: "Invalid input",
      details: [{ field: "email", message: "Enter a valid email address." }],
      correlationId: "corr-1",
    });
  });

  it("falls back to generic values when the error body isn't a valid envelope", async () => {
    await expect(
      withApiError(TestApiError, () => Promise.reject(axiosError(502, "not json"))),
    ).rejects.toMatchObject({
      name: "TestApiError",
      code: "UNKNOWN_ERROR",
      message: "Request failed with status 502",
    });
  });

  it("propagates SessionExpiredError unwrapped, not as the given error class", async () => {
    await expect(
      withApiError(TestApiError, () => Promise.reject(new SessionExpiredError())),
    ).rejects.toBeInstanceOf(SessionExpiredError);
    await expect(
      withApiError(TestApiError, () => Promise.reject(new SessionExpiredError())),
    ).rejects.not.toBeInstanceOf(TestApiError);
  });

  it("propagates a non-axios, non-SessionExpiredError error unwrapped", async () => {
    const plainError = new Error("boom");
    await expect(withApiError(TestApiError, () => Promise.reject(plainError))).rejects.toBe(
      plainError,
    );
  });
});
