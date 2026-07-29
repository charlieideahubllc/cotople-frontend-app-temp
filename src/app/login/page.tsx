// Requirement: AUTH-0001 AC2
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveSafeRedirect } from "@/lib/safe-redirect";
import { LoginForm } from "./LoginForm";

const AUTHENTICATED_FALLBACK = "/dashboard";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const redirectTo = resolveSafeRedirect(next, AUTHENTICATED_FALLBACK);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect(redirectTo);
  }

  return (
    <main className="flex min-h-screen flex-1 items-center justify-center px-6 py-24">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Sign in</h1>
          <p className="text-sm text-muted-foreground">
            Sign in with your Cotople account.
          </p>
        </div>
        <LoginForm redirectTo={redirectTo} />
      </div>
    </main>
  );
}
