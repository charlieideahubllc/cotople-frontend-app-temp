// Requirement: AUTH-0003 AC1
// Defense-in-depth server-side session check for all routes under this
// group. The primary gate is middleware.ts; this re-check covers direct
// server-component rendering paths middleware may not intercept.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/Sidebar";

export default async function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    // fixed + inset-0 pins this shell to the viewport regardless of how
    // body's own height resolves (a plain h-screen flex child was still
    // letting body/html grow taller than 100vh and scroll as a whole,
    // dragging the sidebar along with it instead of only the content pane
    // scrolling).
    // flex-col below `md`: Sidebar's mobile top bar needs to stack above
    // the content pane there, not sit beside it in a row — the sidebar
    // rail itself is `fixed` off-canvas at that width, so it doesn't
    // occupy flex space regardless of this container's direction.
    <div className="fixed inset-0 flex flex-col overflow-hidden md:flex-row">
      <Sidebar />
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
