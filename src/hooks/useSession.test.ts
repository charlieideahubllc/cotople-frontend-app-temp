import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useSession } from "./useSession";

const getUserMock = vi.fn();
let authStateCallback: ((event: string, session: unknown) => void) | null = null;
const unsubscribeMock = vi.fn();
const onAuthStateChangeMock = vi.fn((cb: (event: string, session: unknown) => void) => {
  authStateCallback = cb;
  return { data: { subscription: { unsubscribe: unsubscribeMock } } };
});

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: getUserMock,
      onAuthStateChange: onAuthStateChangeMock,
    },
  }),
}));

const apiFetchMock = vi.fn();
vi.mock("@/lib/api/client", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
  SessionExpiredError: class SessionExpiredError extends Error {},
}));

const resetSessionExpiredGuardMock = vi.fn();
vi.mock("@/lib/api/session-expired", () => ({
  resetSessionExpiredGuard: () => resetSessionExpiredGuardMock(),
}));

const testUser = { id: "u1", email: "user@example.com" };

beforeEach(() => {
  getUserMock.mockReset();
  onAuthStateChangeMock.mockClear();
  unsubscribeMock.mockReset();
  apiFetchMock.mockReset();
  resetSessionExpiredGuardMock.mockReset();
  authStateCallback = null;
});

// Requirement: AUTH-0002 AC2 (no session)
describe("useSession with no session", () => {
  it("resolves user: null, role: null", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });

    const { result } = renderHook(() => useSession());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
    expect(result.current.role).toBeNull();
  });
});

// Requirement: AUTH-0005 AC3 (fail closed)
describe("useSession with a session but a failed /api/v1/me call", () => {
  it("resolves role: null", async () => {
    getUserMock.mockResolvedValue({ data: { user: testUser } });
    apiFetchMock.mockRejectedValue(new Error("network error"));

    const { result } = renderHook(() => useSession());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toEqual(testUser);
    expect(result.current.role).toBeNull();
  });

  it("resolves role: null when the backend responds non-OK", async () => {
    getUserMock.mockResolvedValue({ data: { user: testUser } });
    apiFetchMock.mockResolvedValue(new Response(null, { status: 500 }));

    const { result } = renderHook(() => useSession());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.role).toBeNull();
  });
});

// PR #5 review finding: session-expired.ts's guard was a permanent latch
// with no production reset path. useSession() must reset it whenever it
// confirms a valid user, so a later genuine expiry isn't swallowed.
describe("useSession session-expired guard reset", () => {
  it("resets the session-expired guard whenever a user resolves", async () => {
    getUserMock.mockResolvedValue({ data: { user: testUser } });
    apiFetchMock.mockResolvedValue(new Response(null, { status: 500 }));

    const { result } = renderHook(() => useSession());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(resetSessionExpiredGuardMock).toHaveBeenCalled();
  });

  it("does not reset the guard when there is no user", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });

    const { result } = renderHook(() => useSession());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(resetSessionExpiredGuardMock).not.toHaveBeenCalled();
  });
});

// Requirement: AUTH-0005 AC1
describe("useSession with a session and a resolved role", () => {
  it("reflects the backend's role value", async () => {
    getUserMock.mockResolvedValue({ data: { user: testUser } });
    apiFetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: "u1", role: "admin", display_name: "U", is_active: true }), {
        status: 200,
      }),
    );

    const { result } = renderHook(() => useSession());

    await waitFor(() => expect(result.current.role).toBe("admin"));
    expect(result.current.user).toEqual(testUser);
  });
});

// Requirement: AUTH-0002 AC2 (reactive updates)
describe("useSession auth state changes", () => {
  it("updates output when onAuthStateChange fires", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    apiFetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: "u1", role: "staff", display_name: "U", is_active: true }), {
        status: 200,
      }),
    );

    const { result } = renderHook(() => useSession());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();

    act(() => {
      authStateCallback?.("SIGNED_IN", { user: testUser });
    });

    await waitFor(() => expect(result.current.user).toEqual(testUser));
    await waitFor(() => expect(result.current.role).toBe("staff"));
  });
});
