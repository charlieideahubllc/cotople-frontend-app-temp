"use client";

// Requirements: CAP-0003 AC3
import { useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CaptureSection, type CaptureSectionHandle } from "@/app/(protected)/capture/CaptureSection";

// SRS §6.2: the capture method screen is available to both Admin and
// Staff — not role-gated, unlike the event create/edit screens.
//
// Uses CaptureSection (not a bare ImageCaptureForm + ManualCaptureForm
// pair) so a business-card upload here actually runs extraction and
// autofills the manual fields, same as the event create/edit forms
// (event-image-form spec) — the previous version of this page rendered
// both forms side by side with no wiring between them at all.
export default function CaptureMethodPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const captureRef = useRef<CaptureSectionHandle>(null);
  const [submitting, setSubmitting] = useState(false);
  // True while CaptureSection is parked on its own duplicate/ambiguous
  // review, waiting on the user there — submit()'s promise already
  // resolved by that point, so `submitting` alone doesn't cover this
  // window. Without this, a second click here would discard the pending
  // review and silently re-issue the resolve/confirm call.
  const [awaitingReview, setAwaitingReview] = useState(false);
  // True while the business-card image is still uploading — isEmpty() only
  // looks at manual field values and a *finished* upload's imageId, so
  // without this a click mid-upload would proceed and silently abandon the
  // in-flight image (see CaptureSection's onUploadPendingChange doc).
  const [uploadPending, setUploadPending] = useState(false);
  const saveBlocked = awaitingReview || uploadPending;

  async function handleSave() {
    if (saveBlocked) {
      return;
    }
    setSubmitting(true);
    try {
      await captureRef.current?.submit(params.id);
      // CaptureSection/ManualCaptureForm shows its own duplicate/ambiguous
      // review UI in place when needed; this page only navigates away once
      // that flow (immediately or after review) reaches a real success —
      // see the onSaved callback below.
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-12">
      <button
        type="button"
        onClick={() => router.back()}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline"
      >
        <ArrowLeft className="size-4" />
        Back to Events
      </button>
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Capture Contact</h1>
      <CaptureSection
        ref={captureRef}
        eventId={params.id}
        onSaved={() => router.push(`/events/${params.id}`)}
        onAwaitingReviewChange={setAwaitingReview}
        onUploadPendingChange={setUploadPending}
      />
      <Button className="mt-6" onClick={handleSave} disabled={submitting || saveBlocked}>
        {submitting
          ? "Saving..."
          : uploadPending
            ? "Wait for the business card image to finish uploading"
            : awaitingReview
              ? "Resolve the review above first"
              : "Save Contact"}
      </Button>
    </main>
  );
}
