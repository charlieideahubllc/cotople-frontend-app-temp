// Requirements: AUTH-0003 AC1, AC2; AUTH-0002 AC3
// Session-refresh + route-gating helper used by the root middleware.ts.
// Uses getUser() (network-verified), never getSession() alone, for this
// security-relevant check — see design.md Decision ("Use getUser(), not
// getSession(), in middleware").
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Paths that do not require an authenticated session. Anything not listed
// here is treated as protected by default (fail closed) — new public routes
// must be added explicitly.
const PUBLIC_PATHS = new Set(["/", "/login"]);

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname);
}

// Same rule as src/lib/supabase/client.ts: proxy.ts runs in the Edge
// runtime, which also requires static, literal `process.env.X` references
// to inline NEXT_PUBLIC_* vars at build time. Don't refactor these two
// reads behind a dynamic `getEnv(name)` helper.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env.local and fill in real values.",
    );
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  if (isPublicPath(request.nextUrl.pathname)) {
    return response;
  }

  let user = null;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (!error) {
      user = data.user;
    }
  } catch {
    // Fail closed: treat an unreachable/erroring Supabase call as
    // unauthenticated rather than letting the request through.
    user = null;
  }

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}
