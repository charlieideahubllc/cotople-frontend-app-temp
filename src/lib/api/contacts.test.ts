import { describe, it, expect, vi, beforeEach } from "vitest";
import { AxiosError, AxiosHeaders } from "axios";

const { apiClientMock, SessionExpiredErrorStub } = vi.hoisted(() => {
  class SessionExpiredErrorStub extends Error {}
  return {
    apiClientMock: { post: vi.fn(), get: vi.fn() },
    SessionExpiredErrorStub,
  };
});

vi.mock("./axiosClient", () => ({
  apiClient: apiClientMock,
  SessionExpiredError: SessionExpiredErrorStub,
}));

import {
  resolveContact,
  createEventContact,
  listContacts,
  getContact,
  listEventContacts,
  ContactsApiError,
} from "./contacts";
import type {
  Contact,
  ContactDetail,
  ContactInput,
  CreateEventContactResult,
  Occurrence,
  ResolveResult,
} from "./contacts.types";

const sampleInput: ContactInput = {
  first_name: "Ada",
  last_name: "Lovelace",
  phone: "+15551234567",
};

const sampleContact: Contact = {
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
};

beforeEach(() => {
  apiClientMock.post.mockReset();
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

// Requirement: CAP-0001 AC2, AC3; CAP-0005 AC1; CAP-0008 AC1, AC2
describe("contacts API module", () => {
  describe("resolveContact", () => {
    it("POSTs phone/email (no event_id — not event-scoped) to /api/v1/contacts/resolve and parses the response", async () => {
      const result: ResolveResult = { match: "no_match", contact: null, reason: null };
      apiClientMock.post.mockResolvedValue({ data: result });

      const returned = await resolveContact({ phone: sampleInput.phone });

      expect(returned).toEqual(result);
      expect(apiClientMock.post).toHaveBeenCalledWith("/api/v1/contacts/resolve", {
        phone: sampleInput.phone,
      });
    });

    it("throws ContactsApiError with the parsed envelope on a non-OK response", async () => {
      apiClientMock.post.mockRejectedValue(
        axiosError(400, { success: false, code: "VALIDATION_ERROR", message: "Invalid phone" }),
      );

      await expect(resolveContact({ phone: sampleInput.phone })).rejects.toMatchObject({
        name: "ContactsApiError",
        code: "VALIDATION_ERROR",
        message: "Invalid phone",
      });
    });

    it("propagates SessionExpiredError unwrapped, not as ContactsApiError", async () => {
      apiClientMock.post.mockRejectedValue(new SessionExpiredErrorStub("expired"));

      await expect(resolveContact({ phone: sampleInput.phone })).rejects.toBeInstanceOf(
        SessionExpiredErrorStub,
      );
      await expect(resolveContact({ phone: sampleInput.phone })).rejects.not.toBeInstanceOf(
        ContactsApiError,
      );
    });
  });

  describe("createEventContact", () => {
    it("POSTs the input with the Idempotency-Key header and parses the response", async () => {
      const result: CreateEventContactResult = {
        contact: sampleContact,
        occurrence: {
          id: "occ-1",
          event_id: "e1",
          contact_id: "c1",
          captured_by_profile_id: "p1",
          captured_at: "2026-07-27T00:00:00.000Z",
          capture_method: "manual",
          notes: null,
          contact_image_id: null,
          duplicate_resolution: "new",
          ghl_sync_status: "pending",
        },
        duplicate_resolution: "new",
        pending_review_fields: [],
      };
      apiClientMock.post.mockResolvedValue({ data: result });

      const returned = await createEventContact("e1", sampleInput, "idem-key-123");

      expect(returned).toEqual(result);
      expect(apiClientMock.post).toHaveBeenCalledWith(
        "/api/v1/events/e1/contacts",
        sampleInput,
        { headers: { "Idempotency-Key": "idem-key-123" } },
      );
    });

    it("throws ContactsApiError on a non-OK response", async () => {
      apiClientMock.post.mockRejectedValue(
        axiosError(409, { success: false, code: "CONFLICT", message: "Ambiguous match" }),
      );

      await expect(createEventContact("e1", sampleInput, "idem-key-123")).rejects.toMatchObject({
        code: "CONFLICT",
      });
    });

    it("propagates SessionExpiredError unwrapped, not as ContactsApiError", async () => {
      apiClientMock.post.mockRejectedValue(new SessionExpiredErrorStub("expired"));

      await expect(
        createEventContact("e1", sampleInput, "idem-key-123"),
      ).rejects.toBeInstanceOf(SessionExpiredErrorStub);
    });
  });

  describe("listContacts", () => {
    it("GETs with limit/offset and parses the paginated response", async () => {
      apiClientMock.get.mockResolvedValue({
        data: { items: [sampleContact], total: 1, limit: 200, offset: 0 },
      });

      const result = await listContacts({ limit: 200, offset: 0 });

      expect(result).toEqual({ items: [sampleContact], total: 1, limit: 200, offset: 0 });
      expect(apiClientMock.get).toHaveBeenCalledWith("/api/v1/contacts", {
        params: { limit: 200, offset: 0 },
      });
    });

    it("throws ContactsApiError on a non-OK response", async () => {
      apiClientMock.get.mockRejectedValue(
        axiosError(500, { success: false, code: "SERVER_ERROR", message: "boom" }),
      );

      await expect(listContacts()).rejects.toMatchObject({ code: "SERVER_ERROR" });
    });
  });

  describe("getContact", () => {
    it("GETs the single-contact route and parses the response including occurrences", async () => {
      const detail: ContactDetail = { ...sampleContact, occurrences: [] };
      apiClientMock.get.mockResolvedValue({ data: detail });

      const result = await getContact("c1");

      expect(result).toEqual(detail);
      expect(apiClientMock.get).toHaveBeenCalledWith("/api/v1/contacts/c1");
    });
  });

  describe("listEventContacts", () => {
    function occurrence(overrides: Partial<Occurrence> = {}): Occurrence {
      return {
        id: "occ-1",
        event_id: "e1",
        contact_id: "c1",
        captured_by_profile_id: "p1",
        captured_at: "2026-07-27T00:00:00.000Z",
        capture_method: "manual",
        notes: null,
        contact_image_id: null,
        duplicate_resolution: "new",
        ghl_sync_status: "pending",
        ...overrides,
      };
    }

    it("fetches every contact, then filters each contact's occurrences down to the given event", async () => {
      const contactA = { ...sampleContact, id: "c1" };
      const contactB = { ...sampleContact, id: "c2" };

      apiClientMock.get.mockImplementation((url: string) => {
        if (url === "/api/v1/contacts") {
          return Promise.resolve({
            data: { items: [contactA, contactB], total: 2, limit: 200, offset: 0 },
          });
        }
        if (url === "/api/v1/contacts/c1") {
          return Promise.resolve({
            data: {
              ...contactA,
              occurrences: [
                occurrence({ id: "occ-1", event_id: "e1" }),
                occurrence({ id: "occ-2", event_id: "OTHER_EVENT" }),
              ],
            },
          });
        }
        if (url === "/api/v1/contacts/c2") {
          return Promise.resolve({
            data: { ...contactB, occurrences: [occurrence({ id: "occ-3", event_id: "e1" })] },
          });
        }
        throw new Error(`unexpected GET ${url}`);
      });

      const result = await listEventContacts("e1");

      expect(result.map((r) => r.occurrence.id).sort()).toEqual(["occ-1", "occ-3"]);
      expect(result.every((r) => r.occurrence.event_id === "e1")).toBe(true);
    });

    it("returns an empty array when no contact has an occurrence for the given event", async () => {
      apiClientMock.get.mockImplementation((url: string) => {
        if (url === "/api/v1/contacts") {
          return Promise.resolve({
            data: { items: [sampleContact], total: 1, limit: 200, offset: 0 },
          });
        }
        return Promise.resolve({
          data: { ...sampleContact, occurrences: [occurrence({ event_id: "SOME_OTHER_EVENT" })] },
        });
      });

      const result = await listEventContacts("e1");

      expect(result).toEqual([]);
    });

    it("paginates through listContacts until every page is fetched", async () => {
      const page1 = Array.from({ length: 200 }, (_, i) => ({ ...sampleContact, id: `c${i}` }));
      const page2 = [{ ...sampleContact, id: "c200" }];

      apiClientMock.get.mockImplementation((url: string, config?: { params?: { offset?: number } }) => {
        if (url === "/api/v1/contacts") {
          const offset = config?.params?.offset ?? 0;
          return Promise.resolve({
            data:
              offset === 0
                ? { items: page1, total: 201, limit: 200, offset: 0 }
                : { items: page2, total: 201, limit: 200, offset: 200 },
          });
        }
        return Promise.resolve({ data: { ...sampleContact, occurrences: [] } });
      });

      await listEventContacts("e1");

      const contactsCalls = apiClientMock.get.mock.calls.filter(
        ([url]) => url === "/api/v1/contacts",
      );
      expect(contactsCalls).toHaveLength(2);
    });
  });
});
