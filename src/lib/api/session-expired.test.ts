import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  handleSessionExpired,
  resetSessionExpiredGuard,
  SESSION_EXPIRED_MESSAGE,
  SESSION_EXPIRED_STORAGE_KEY,
} from "./session-expired";

beforeEach(() => {
  resetSessionExpiredGuard();
  window.sessionStorage.clear();
});

// Requirement: AUTH-0004 AC1, AC2
describe("handleSessionExpired", () => {
  it("writes the required message to sessionStorage and navigates to /login", () => {
    const navigate = vi.fn();

    handleSessionExpired(navigate);

    expect(window.sessionStorage.getItem(SESSION_EXPIRED_STORAGE_KEY)).toBe(
      SESSION_EXPIRED_MESSAGE,
    );
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith("/login");
  });

  it("only writes the message and navigates once across concurrent/repeated 401s", () => {
    const navigate = vi.fn();

    handleSessionExpired(navigate);
    handleSessionExpired(navigate);
    handleSessionExpired(navigate);

    expect(navigate).toHaveBeenCalledTimes(1);
  });

  // PR #5 review finding: the guard was previously a permanent latch with
  // no production reset path, safe only by accident of the default
  // navigate causing a full page reload. Now useSession() calls
  // resetSessionExpiredGuard() whenever it confirms a valid user.
  it("fires again for a second, later expiry after the guard is reset (simulates a fresh sign-in via useSession)", () => {
    const navigate = vi.fn();

    handleSessionExpired(navigate);
    expect(navigate).toHaveBeenCalledTimes(1);

    // A caller with a client-side-only `navigate` (e.g. router.push)
    // wouldn't get a full page reload here, so without an explicit reset
    // this second call would previously have been silently swallowed.
    resetSessionExpiredGuard();
    handleSessionExpired(navigate);

    expect(navigate).toHaveBeenCalledTimes(2);
  });
});
