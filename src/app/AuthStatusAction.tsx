"use client";

// Not part of any MVP SRS/auth-login spec requirement — logout is not
// mentioned anywhere in FR-MVP-AUTH-001 or SRS_CHECKLIST.md Section 1.
// Added as a minimal, self-contained dev/testing convenience so the login
// form can be re-tested without manually clearing sb-* cookies in DevTools.
// Still auth/session code (calls supabase.auth.signOut()) — same mandatory
// human review gate as the rest of the auth-login work, per CLAUDE.md.
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/useSession";
import { useSignOut } from "@/hooks/useSignOut";

export function AuthStatusAction() {
  const { user, loading } = useSession();
  const { signOut, signingOut } = useSignOut();

  if (loading) {
    return (
      <Button size="lg" className="h-auto px-8 py-3" disabled>
        Loading...
      </Button>
    );
  }

  if (user) {
    return (
      <>
        <Button
          size="lg"
          className="h-auto px-8 py-3 !text-white"
          render={<Link href="/dashboard" />}
          nativeButton={false}
        >
          Go to Dashboard
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="h-auto px-8 py-3"
          onClick={signOut}
          disabled={signingOut}
        >
          {signingOut ? "Signing out..." : "Log Out"}
        </Button>
      </>
    );
  }

  return (
    <Button
      size="lg"
      className="h-auto px-8 py-3 !text-white"
      render={<Link href="/login" />}
      nativeButton={false}
    >
      Log In
    </Button>
  );
}
