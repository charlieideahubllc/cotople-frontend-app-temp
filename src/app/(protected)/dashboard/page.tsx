"use client";

// Landing page after login. Kept intentionally light — a greeting plus a
// menu of the sections the signed-in user can reach (currently just
// Events; new protected sections add a card here as they ship).
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { useSession } from "@/hooks/useSession";

export default function DashboardPage() {
  const { user } = useSession();

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-12">
      <h1 className="mb-1 text-2xl font-bold tracking-tight">
        {user?.email ? `Welcome, ${user.email}` : "Welcome"}
      </h1>
      <p className="mb-8 text-muted-foreground">What would you like to do?</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/events"
          className="flex items-center gap-4 rounded-lg border border-border p-5 transition-colors hover:bg-muted"
        >
          <CalendarDays className="size-6 text-muted-foreground" />
          <div>
            <p className="font-medium">Events</p>
            <p className="text-sm text-muted-foreground">
              View, create, and manage events.
            </p>
          </div>
        </Link>
      </div>
    </main>
  );
}
