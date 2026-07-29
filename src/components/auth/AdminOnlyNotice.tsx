// Requirement: EVT-0002 AC4
// Shared RequireRole fallback for pages that are Admin-only in their
// entirety (as opposed to a single hidden control within a shared page).
// Placed alongside RequireRole rather than scoped to events/, since future
// Admin-only screens (GHL install/status, SRS_CHECKLIST.md Section 12)
// need the same fallback.
export function AdminOnlyNotice() {
  return (
    <p role="status" className="text-muted-foreground">
      You don&apos;t have access to this page.
    </p>
  );
}
