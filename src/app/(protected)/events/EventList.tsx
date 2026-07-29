"use client";

// Requirements: EVT-0001 AC1, AC2, AC4, AC5, AC6; EVT-0003 AC1; CAP-0003 AC3
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { RequireRole } from "@/components/auth/RequireRole";
import { useSession } from "@/hooks/useSession";
import { EVENTS_PAGE_SIZE, useEventsQuery } from "@/lib/api/events.hooks";
import type { EventStatus } from "@/lib/api/events.types";

// Windows the page-number buttons around the current page instead of
// rendering one per page — with 10 rows/page a few hundred events would
// otherwise produce a few dozen unusable buttons.
function getPageNumbers(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages = new Set([1, total, current - 1, current, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);

  const result: (number | "ellipsis")[] = [];
  let prev: number | undefined;
  for (const page of sorted) {
    if (prev !== undefined && page - prev > 1) {
      result.push("ellipsis");
    }
    result.push(page);
    prev = page;
  }
  return result;
}

function statusBadgeVariant(status: EventStatus): "default" | "secondary" {
  return status === "active" ? "default" : "secondary";
}

export function EventList() {
  const router = useRouter();
  const { user } = useSession();
  const [page, setPage] = useState(1);
  const [ownedOnly, setOwnedOnly] = useState(false);
  const { data, status, error, refetch, isPlaceholderData } = useEventsQuery(
    page,
    ownedOnly ? user?.id : undefined,
  );

  const totalPages = data ? Math.max(1, Math.ceil(data.total / EVENTS_PAGE_SIZE)) : 1;

  function toggleOwnedOnly() {
    setOwnedOnly((v) => !v);
    setPage(1);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Events</h1>
        <div className="flex items-center gap-2">
          <Button
            variant={ownedOnly ? "default" : "outline"}
            className={ownedOnly ? "!text-white" : undefined}
            onClick={toggleOwnedOnly}
            disabled={!user}
          >
            {ownedOnly ? "My Events" : "All Events"}
          </Button>
          <RequireRole allow="admin">
            <Button
              className="!text-white"
              render={<Link href="/events/new" />}
              nativeButton={false}
            >
              New Event
            </Button>
          </RequireRole>
        </div>
      </div>

      {status === "pending" && (
        <div className="space-y-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      )}

      {status === "error" && (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{error instanceof Error ? error.message : "Something went wrong."}</span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {status === "success" && data.items.length === 0 && (
        <p className="text-muted-foreground">No active events yet.</p>
      )}

      {status === "success" && data.items.length > 0 && (
        <div className={isPlaceholderData ? "opacity-60 transition-opacity" : undefined}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((event) => (
                // EVT-0001 AC3: the event detail screen (/events/{id}) is
                // reached via the real <Link> in the Name cell, which gives
                // proper anchor semantics for keyboard/screen-reader users
                // (a `role="link"` on the <tr> itself was non-standard ARIA
                // — a table row's <td> children aren't semantically "inside"
                // a link). The row's own onClick is a mouse-only
                // convenience so clicking anywhere in the row still works;
                // it deliberately doesn't duplicate keyboard handling.
                <TableRow
                  key={event.id}
                  data-event-id={event.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/events/${event.id}`)}
                >
                  <TableCell className="font-medium">
                    <Link
                      href={`/events/${event.id}`}
                      className="hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {event.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(event.starts_at).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(event.status)} className="capitalize">
                      {event.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <Pagination className="mt-4 justify-start">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    aria-disabled={page === 1}
                    className={page === 1 ? "pointer-events-none opacity-50" : undefined}
                    onClick={(e) => {
                      e.preventDefault();
                      if (page > 1) setPage(page - 1);
                    }}
                  />
                </PaginationItem>
                {getPageNumbers(page, totalPages).map((p, i) =>
                  p === "ellipsis" ? (
                    <PaginationItem key={`ellipsis-${i}`}>
                      <PaginationEllipsis />
                    </PaginationItem>
                  ) : (
                    <PaginationItem key={p}>
                      <PaginationLink
                        href="#"
                        isActive={p === page}
                        onClick={(e) => {
                          e.preventDefault();
                          setPage(p);
                        }}
                      >
                        {p}
                      </PaginationLink>
                    </PaginationItem>
                  ),
                )}
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    aria-disabled={page === totalPages}
                    className={page === totalPages ? "pointer-events-none opacity-50" : undefined}
                    onClick={(e) => {
                      e.preventDefault();
                      if (page < totalPages) setPage(page + 1);
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </div>
      )}
    </div>
  );
}
