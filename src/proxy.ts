// Requirements: AUTH-0003 AC1, AC2
// Next.js 16 renamed the "middleware" file convention to "proxy" — see
// https://nextjs.org/docs/messages/middleware-to-proxy. The underlying
// helper is still named updateSession() in lib/supabase/middleware.ts,
// which matches Supabase's own docs terminology for this pattern.
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Run on every request except Next.js internals and common static
    // asset extensions. Public vs. protected path decisions are made
    // inside updateSession() so this stays a single source of truth.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
