"use client";

// Requirements: AUTH-0002 AC2, AC3; AUTH-0005 AC1, AC3
import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { apiFetch, SessionExpiredError } from "@/lib/api/client";
import { resetSessionExpiredGuard } from "@/lib/api/session-expired";
import type { Profile, ProfileRole } from "@/lib/supabase/types";

export interface SessionState {
  user: User | null;
  // AUTH-0005 AC2: role is read for UI convenience only — it is never
  // treated as an authorization boundary. `null` covers "no session",
  // "role not resolved yet", and "role fetch failed" alike, so Admin-only
  // UI stays hidden (fail closed) in every one of those cases.
  role: ProfileRole | null;
  loading: boolean;
}

export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({
    user: null,
    role: null,
    loading: true,
  });

  // Guards against a stale async response (role fetch or getUser) writing
  // state after a newer auth event has already superseded it.
  const requestIdRef = useRef(0);

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    async function resolveForUser(user: User) {
      const requestId = ++requestIdRef.current;
      setState({ user, role: null, loading: true });

      // A valid session is confirmed at this point — any prior
      // "session expired" latch (src/lib/api/session-expired.ts) is now
      // stale. Reset it so a future genuine expiry is handled again
      // instead of silently swallowed.
      resetSessionExpiredGuard();

      let role: ProfileRole | null = null;
      try {
        const response = await apiFetch("/api/v1/me");
        if (response.ok) {
          const profile = (await response.json()) as Profile;
          role = profile.role ?? null;
        }
        // Non-OK, non-401 responses (e.g. backend unreachable, 5xx): fail
        // closed, role stays null — AUTH-0005 AC3.
      } catch (err) {
        // SessionExpiredError is already handled (message + redirect) by
        // apiFetch's interceptor — nothing further to do here besides
        // failing closed on role.
        if (!(err instanceof SessionExpiredError)) {
          role = null;
        }
      }

      if (mounted && requestId === requestIdRef.current) {
        setState({ user, role, loading: false });
      }
    }

    function resolveForNoUser() {
      requestIdRef.current += 1;
      if (mounted) {
        setState({ user: null, role: null, loading: false });
      }
    }

    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      if (data.user) {
        void resolveForUser(data.user);
      } else {
        resolveForNoUser();
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        void resolveForUser(session.user);
      } else {
        resolveForNoUser();
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return state;
}
