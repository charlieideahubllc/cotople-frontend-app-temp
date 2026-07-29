// Requirements: AUTH-0002 AC1, AUTH-0003 AC1
// Server-only Supabase client. Use only in server components, route handlers,
// and middleware. Never import this into a "use client" component.
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. Copy .env.example to .env.local and fill in real values.`,
    );
  }
  return value;
}

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    getEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // setAll called from a Server Component that can't set cookies
            // (e.g. during static rendering). Session refresh in this case
            // is handled by middleware instead — safe to ignore here.
          }
        },
      },
    },
  );
}
