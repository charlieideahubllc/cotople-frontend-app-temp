"use client";

// Shared sign-out action for every call site that offers a "Log Out"
// control (NavBar, AuthStatusAction) — same signOut -> redirect -> refresh
// sequence, so it isn't reimplemented (and potentially drift) per component.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function useSignOut() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return { signOut, signingOut };
}
