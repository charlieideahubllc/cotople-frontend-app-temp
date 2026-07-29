import { describe, it, expect, vi, beforeEach } from "vitest";
import { AxiosError, AxiosHeaders } from "axios";

const { apiClientMock, SessionExpiredErrorStub } = vi.hoisted(() => {
  class SessionExpiredErrorStub extends Error {}
  return {
    apiClientMock: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
    SessionExpiredErrorStub,
  };
});

vi.mock("./axiosClient", () => ({
  apiClient: apiClientMock,
  SessionExpiredError: SessionExpiredErrorStub,
}));

import { listEvents, getEvent, createEvent, updateEvent, archiveEvent, EventsApiError } from "./events";
import type { Event } from "./events.types";

const sampleEvent: Event = {
  id: "e1",
  name: "Trade Show",
  starts_at: "2026-08-01T10:00:00.000Z",
  location: null,
  notes: null,
  status: "active",
  owner_profile_id: "p1",
  created_at: "2026-07-01T00:00:00.000Z",
  updated_at: "2026-07-01T00:00:00.000Z",
};

beforeEach(() => {
  apiClientMock.get.mockReset();
  apiClientMock.post.mockReset();
  apiClientMock.patch.mockReset();
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

// Requirement: API-0001 AC1, AC2
describe("events API module", () => {
  describe("listEvents", () => {
    it("parses a successful response into the paginated envelope", async () => {
      apiClientMock.get.mockResolvedValue({
        data: { items: [sampleEvent], total: 1, limit: 10, offset: 0 },
      });

      const result = await listEvents({ limit: 10, offset: 0 });

      expect(result).toEqual({ items: [sampleEvent], total: 1, limit: 10, offset: 0 });
      expect(apiClientMock.get).toHaveBeenCalledWith("/api/v1/events", {
        params: { limit: 10, offset: 0 },
      });
    });

    it("throws EventsApiError with the parsed envelope on a non-OK response", async () => {
      apiClientMock.get.mockRejectedValue(
        axiosError(500, {
          success: false,
          code: "SERVER_ERROR",
          message: "boom",
          correlation_id: "corr-1",
        }),
      );

      await expect(listEvents()).rejects.toMatchObject({
        name: "EventsApiError",
        code: "SERVER_ERROR",
        message: "boom",
        correlationId: "corr-1",
      });
    });

    it("falls back to generic values when the error body isn't valid JSON", async () => {
      apiClientMock.get.mockRejectedValue(axiosError(502, "not json"));

      await expect(listEvents()).rejects.toMatchObject({
        name: "EventsApiError",
        code: "UNKNOWN_ERROR",
      });
    });

    it("propagates SessionExpiredError unwrapped, not as EventsApiError", async () => {
      apiClientMock.get.mockRejectedValue(new SessionExpiredErrorStub("expired"));

      await expect(listEvents()).rejects.toBeInstanceOf(SessionExpiredErrorStub);
      await expect(listEvents()).rejects.not.toBeInstanceOf(EventsApiError);
    });
  });

  describe("getEvent", () => {
    it("GETs the single-event route and parses the response", async () => {
      apiClientMock.get.mockResolvedValue({ data: sampleEvent });

      const result = await getEvent("e1");

      expect(result).toEqual(sampleEvent);
      expect(apiClientMock.get).toHaveBeenCalledWith("/api/v1/events/e1");
    });
  });

  describe("createEvent", () => {
    it("POSTs the input as JSON and parses the response", async () => {
      apiClientMock.post.mockResolvedValue({ data: sampleEvent });

      const result = await createEvent({ name: "Trade Show", starts_at: sampleEvent.starts_at });

      expect(result).toEqual(sampleEvent);
      expect(apiClientMock.post).toHaveBeenCalledWith("/api/v1/events", {
        name: "Trade Show",
        starts_at: sampleEvent.starts_at,
      });
    });

    it("throws EventsApiError on a non-OK response", async () => {
      apiClientMock.post.mockRejectedValue(
        axiosError(400, { success: false, code: "VALIDATION_ERROR", message: "Invalid name" }),
      );

      await expect(createEvent({ name: "", starts_at: "" })).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
      });
    });
  });

  describe("updateEvent", () => {
    it("PATCHes the input and parses the response", async () => {
      apiClientMock.patch.mockResolvedValue({ data: sampleEvent });

      const result = await updateEvent("e1", { location: "Hall B" });

      expect(result).toEqual(sampleEvent);
      expect(apiClientMock.patch).toHaveBeenCalledWith("/api/v1/events/e1", {
        location: "Hall B",
      });
    });
  });

  describe("archiveEvent", () => {
    it("POSTs to the archive endpoint and parses the response", async () => {
      apiClientMock.post.mockResolvedValue({ data: { ...sampleEvent, status: "archived" } });

      const result = await archiveEvent("e1");

      expect(result.status).toBe("archived");
      expect(apiClientMock.post).toHaveBeenCalledWith("/api/v1/events/e1/archive");
    });
  });
});
