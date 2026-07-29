import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const getSessionMock = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getSession: getSessionMock },
  }),
}));

const handleSessionExpiredMock = vi.fn();
vi.mock("./session-expired", () => ({
  handleSessionExpired: handleSessionExpiredMock,
}));

const originalEnv = process.env.NEXT_PUBLIC_API_BASE_URL;

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.test";
  getSessionMock.mockReset();
  handleSessionExpiredMock.mockReset();
  getSessionMock.mockResolvedValue({ data: { session: { access_token: "token-123" } } });
});

afterEach(() => {
  process.env.NEXT_PUBLIC_API_BASE_URL = originalEnv;
  vi.unstubAllGlobals();
  vi.resetModules();
});

// Requirement: AUTH-0004 AC1, AC2
describe("apiFetch session-expiry interceptor", () => {
  it("attaches the bearer token and returns the response on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const { apiFetch } = await import("./client");
    const response = await apiFetch("/api/v1/me");

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.test/api/v1/me",
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );
    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Headers).get("Authorization")).toBe("Bearer token-123");
    expect(handleSessionExpiredMock).not.toHaveBeenCalled();
  });

  it("calls handleSessionExpired exactly once and throws on a single 401", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    const { apiFetch, SessionExpiredError } = await import("./client");

    await expect(apiFetch("/api/v1/me")).rejects.toBeInstanceOf(SessionExpiredError);
    expect(handleSessionExpiredMock).toHaveBeenCalledTimes(1);
  });

  it("calls handleSessionExpired once per call, even for concurrent 401s (interceptor invoked once per failing request)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    const { apiFetch, SessionExpiredError } = await import("./client");

    const results = await Promise.allSettled([
      apiFetch("/api/v1/me"),
      apiFetch("/api/v1/contacts"),
    ]);

    for (const result of results) {
      expect(result.status).toBe("rejected");
      if (result.status === "rejected") {
        expect(result.reason).toBeInstanceOf(SessionExpiredError);
      }
    }
    // apiFetch itself calls the (mocked) handleSessionExpired once per
    // failing call — de-duplicating the actual navigation/message-write
    // across concurrent callers is handleSessionExpired's own
    // responsibility, verified separately in session-expired.test.ts.
    expect(handleSessionExpiredMock).toHaveBeenCalledTimes(2);
  });
});
