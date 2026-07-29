"use client";

// Requirements: CAP-0001 AC5
interface CaptureSuccessProps {
  syncStatus: "pending" | "synced" | "failed";
}

// Exact copy from SRS §6.3 for pending/failed. §6.3's table has no distinct
// entry for an already-synced result, so a generic success line is used —
// the SRS only mandates specific wording for the pending/failed cases.
const MESSAGE: Record<CaptureSuccessProps["syncStatus"], string> = {
  pending: "The contact is saved. HighLevel synchronization is still pending.",
  failed: "The contact is saved, but HighLevel synchronization failed. An administrator can retry.",
  synced: "The contact is saved and synchronized with HighLevel.",
};

export function CaptureSuccess({ syncStatus }: CaptureSuccessProps) {
  return (
    <div role="status" data-testid="capture-success" className="space-y-1.5">
      <p className="text-sm font-medium">Contact saved.</p>
      <p className="text-sm text-muted-foreground">{MESSAGE[syncStatus]}</p>
    </div>
  );
}
