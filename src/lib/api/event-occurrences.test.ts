import { describe, it, expect, vi, beforeEach } from "vitest";
import { AxiosError, AxiosHeaders } from "axios";

const { apiClientMock } = vi.hoisted(() => ({
  apiClientMock: { get: vi.fn() },
}));

vi.mock("./axiosClient", () => ({
  apiClient: apiClientMock,
  SessionExpiredError: class SessionExpiredError extends Error {},
}));

import { listEventOccurrences, EventOccurrencesApiError } from "./event-occurrences";
import type { EventOccurrenceListResult } from "./event-occurrences.types";

beforeEach(() => {
  apiClientMock.get.mockReset();
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

const sampleResult: EventOccurrenceListResult = {
  items: [
    {
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
      business_card_image_url: "https://storage.example.com/signed?token=abc",
      selfie_image_url: null,
    },
  ],
  total: 1,
  limit: 50,
  offset: 0,
};

// Requirement: EIF-0005 AC2, AC3, AC4
describe("event-occurrences API module", () => {
  it("GETs with the given filters and parses the paginated response", async () => {
    apiClientMock.get.mockResolvedValue({ data: sampleResult });

    const result = await listEventOccurrences({ eventId: "e1", limit: 50, offset: 0 });

    expect(result).toEqual(sampleResult);
    expect(apiClientMock.get).toHaveBeenCalledWith("/api/v1/event-occurrences", {
      params: {
        event_id: "e1",
        contact_id: undefined,
        sort_by: undefined,
        sort_order: undefined,
        limit: 50,
        offset: 0,
      },
    });
  });

  it("throws EventOccurrencesApiError with the parsed envelope on a non-OK response", async () => {
    apiClientMock.get.mockRejectedValue(
      axiosError(500, { success: false, code: "SERVER_ERROR", message: "boom" }),
    );

    await expect(listEventOccurrences({ eventId: "e1" })).rejects.toBeInstanceOf(
      EventOccurrencesApiError,
    );
    apiClientMock.get.mockRejectedValue(
      axiosError(500, { success: false, code: "SERVER_ERROR", message: "boom" }),
    );
    await expect(listEventOccurrences({ eventId: "e1" })).rejects.toMatchObject({
      code: "SERVER_ERROR",
    });
  });

  it("returns an empty paginated result rather than throwing for an unmatched event_id", async () => {
    apiClientMock.get.mockResolvedValue({
      data: { items: [], total: 0, limit: 50, offset: 0 },
    });

    const result = await listEventOccurrences({ eventId: "no-such-event" });

    expect(result).toEqual({ items: [], total: 0, limit: 50, offset: 0 });
  });
});
