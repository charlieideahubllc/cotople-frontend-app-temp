"use client";

// Shared left sidebar navigation for all authenticated (protected) pages.
// Replaces the previous top NavBar with a fixed left rail: a Homepage icon,
// then the app's sections (Dashboard, Event List, Client List), and a Log
// Out action pinned to the bottom.
//
// Responsive: below `md`, the rail becomes an off-canvas drawer (fixed,
// translated out of view) opened via a mobile-only top bar, with a
// backdrop to close it — the previous version rendered the full-width
// `aside` unconditionally, which just got squeezed into a useless sliver
// on phone-width viewports instead of hiding.
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, CalendarDays, Users, LogOut, Menu, X } from "lucide-react";
import { useSignOut } from "@/hooks/useSignOut";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/events", label: "Event List", icon: CalendarDays },
  { href: "/contacts", label: "Client List", icon: Users },
];

export function Sidebar() {
  const pathname = usePathname();
  const { signOut, signingOut } = useSignOut();
  const [isOpen, setIsOpen] = useState(false);

  // Close the mobile drawer automatically on navigation — otherwise it
  // would stay open, covering the page the user just tapped into. Adjusted
  // during render (React's documented pattern for "reset state when a prop
  // changes") rather than in an effect, which would cause an extra render
  // pass just to flip this one flag back off.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setIsOpen(false);
  }

  return (
    <>
      {/* Mobile-only top bar — the aside below is off-canvas by default
          under `md`, so this is the only way to reach navigation there. */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3 md:hidden">
        <Link href="/" aria-label="Cotople home" className="flex items-center bg-transparent">
          <Image
            src="https://www.cotople.com/wp-content/uploads/2025/07/logo-whitetext-768x269.png"
            alt="Cotople"
            width={768}
            height={269}
            className="h-8 w-auto bg-transparent object-contain"
            priority
          />
        </Link>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Open navigation menu"
          className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>
      </div>

      {isOpen && (
        <div
          data-testid="sidebar-backdrop"
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-screen w-64 shrink-0 flex-col overflow-y-auto border-r border-border bg-background transition-transform duration-200 ease-in-out",
          isOpen ? "translate-x-0" : "-translate-x-full",
          "md:sticky md:top-0 md:z-auto md:w-56 md:translate-x-0",
        )}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-5 md:justify-center">
          <Link
            href="/"
            aria-label="Homepage"
            className="flex flex-1 items-center justify-center bg-transparent"
          >
            <Image
              src="https://www.cotople.com/wp-content/uploads/2025/07/logo-whitetext-768x269.png"
              alt="Cotople"
              width={768}
              height={269}
              className="h-14 w-auto bg-transparent object-contain"
              priority
            />
          </Link>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="Close navigation menu"
            className="shrink-0 rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-2">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  active && "bg-muted text-foreground",
                )}
              >
                <Icon
                  className={cn("size-5 shrink-0 stroke-[1.75]", active && "text-primary")}
                  aria-hidden="true"
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={signOut}
          disabled={signingOut}
          className="flex items-center gap-2.5 border-t border-border px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
        >
          <LogOut className="size-4" />
          {signingOut ? "Signing out..." : "Log Out"}
        </button>
      </aside>
    </>
  );
}
