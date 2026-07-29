// Requirements: AUTH-0001 AC1, AUTH-0006 AC2
// Browser-only Supabase client. Import this only from "use client" components.
// Never import this into server components, route handlers, or middleware —
// use lib/supabase/server.ts there instead.
import { createBrowserClient } from "@supabase/ssr";

// NEXT_PUBLIC_* vars must be read via static, literal `process.env.X`
// references — Next.js only inlines them into the client bundle when it can
// see the literal property access at build time. Dynamic access such as
// `process.env[name]` defeats that replacement and silently evaluates to
// undefined in the browser, even when the value is correctly set in
// .env.local (this bit us once — keep these two reads inline, don't
// refactor them behind a generic `getEnv(name)` helper again).
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function createClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env.local and fill in real values.",
    );
  }
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
