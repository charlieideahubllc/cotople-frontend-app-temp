// Requirements: AUTH-0004 AC1, AC2
// Client-only. Centralizes the "session expired" UX so every authenticated
// API call gets the same behavior instead of each feature re-implementing
// it (see .kiro/specs/auth-login/design.md Decision on the shared interceptor).
export const SESSION_EXPIRED_MESSAGE =
  "Your session expired. Sign in again; your unsaved draft may need to be re-entered.";

// The login page reads and clears this on mount to show the message once.
export const SESSION_EXPIRED_STORAGE_KEY = "cotople:session-expired-message";

let redirecting = false;

// Guarded so N concurrent 401s from different in-flight requests only
// produce one message write and one redirect, not one per failing call.
//
// This guard is only correct as long as something resets it once the user
// has a new valid session — otherwise it's a permanent latch that would
// silently swallow every *subsequent* session-expiry event for the rest of
// the page's lifetime (PR #5 review finding). It happened to be safe when
// the only caller used the default `navigate` (a full page reload, which
// wipes all JS module state), but that was incidental, not guaranteed by
// this function's own contract — the `navigate` parameter explicitly
// allows a client-side-only navigation instead. useSession() calls
// resetSessionExpiredGuard() whenever it confirms a valid user, which is
// the correct signal that any prior "expired" state is now stale.
export function handleSessionExpired(navigate: (url: string) => void = defaultNavigate): void {
  if (redirecting) {
    return;
  }
  redirecting = true;

  try {
    window.sessionStorage.setItem(SESSION_EXPIRED_STORAGE_KEY, SESSION_EXPIRED_MESSAGE);
  } catch {
    // sessionStorage unavailable (e.g. private browsing edge cases) — the
    // redirect still happens, the user just won't see the flash message.
  }

  navigate("/login");
}

function defaultNavigate(url: string): void {
  window.location.assign(url);
}

// Call whenever a valid session is (re)confirmed, so a future session
// expiry is handled again rather than silently swallowed by the guard
// above. Currently called from useSession() on every resolved user.
export function resetSessionExpiredGuard(): void {
  redirecting = false;
}
