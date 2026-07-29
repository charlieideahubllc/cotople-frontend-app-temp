"use client";

// Requirements: AUTHZ-0001 AC1-AC4; AUTHZ-0003 AC1-AC2
//
// UX convenience only, per AUTHZ-0002 AC1 — this does NOT enforce
// authorization. It only hides/shows UI in the browser; the corresponding
// backend endpoint must independently reject an unauthorized request on
// its own, since a user can always reach this component's children through
// means other than clicking a rendered control (direct API calls, browser
// devtools, a stale cached page, etc). See MVP SRS §4.3.
import type { ReactElement, ReactNode } from "react";
import { useSession } from "@/hooks/useSession";
import type { ProfileRole } from "@/lib/supabase/types";

interface RequireRoleProps {
  allow: ProfileRole | ProfileRole[];
  children: ReactNode;
  fallback?: ReactNode;
}

export function RequireRole({
  allow,
  children,
  fallback = null,
}: RequireRoleProps): ReactElement {
  const { role, loading } = useSession();

  // AUTHZ-0003 AC2: loading and "no role" are both treated as hidden —
  // never render children before role is confirmed, to avoid an Admin
  // control flashing visibly and then disappearing.
  if (loading || role === null) {
    return <>{fallback}</>;
  }

  const allowedRoles = Array.isArray(allow) ? allow : [allow];
  if (!allowedRoles.includes(role)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
