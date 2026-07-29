"use client";

// Requirements: EIF-0001 AC1, AC2, AC3, AC4, AC5, AC6; EIF-0002 AC5
//
// Owns the extraction lifecycle that sits between ImageCaptureForm's upload
// and ManualCaptureForm's fields: runs extract() as soon as the business
// card finishes uploading, tracks its state, and surfaces a status
// indicator (extracting / failed / succeeded) distinct from
// ImageDropzoneField's own upload-progress UI (event-image-form/design.md
// Architecture). ManualCaptureForm consumes the resulting ImageCaptureState
// directly for autofill and confirm-path submission.
import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { useExtractImageMutation } from "@/lib/api/images.hooks";
import type { ExtractableFieldName, ExtractedField } from "@/lib/api/images.types";
import { ImageCaptureForm } from "./ImageCaptureForm";
import { ManualCaptureForm, type ManualCaptureFormHandle } from "./ManualCaptureForm";

export type ImageCaptureStatus = "extracting" | "completed" | "failed" | "skipped";

export interface ImageCaptureState {
  imageId: string;
  status: ImageCaptureStatus;
  fields: Partial<Record<ExtractableFieldName, ExtractedField>>;
  warnings: string[];
  captureMethod: "image" | "qr" | "mixed" | null;
}

export interface CaptureSectionProps {
  // Optional so this section can be embedded where no event exists yet
  // (event-create page) — matches ManualCaptureForm's own existing
  // eventId-optional contract (EIF-0004's Decision: no change to that
  // gating in this spec).
  eventId?: string;
  // Forwarded to ManualCaptureForm — see its own onSaved doc.
  onSaved?: () => void;
  // Forwarded to ManualCaptureForm — see its own onAwaitingReviewChange doc.
  onAwaitingReviewChange?: (awaitingReview: boolean) => void;
  // Fired whenever the business-card upload's in-flight state changes (see
  // ImageDropzoneField's onUploadPendingChange doc). isEmpty() only looks at
  // manual field values and a *finished* upload's imageId — while the
  // upload is still running, isEmpty() would wrongly report the section as
  // unused, letting a caller submit without it and silently abandon the
  // in-flight image. Callers must gate submission on this too.
  onUploadPendingChange?: (isPending: boolean) => void;
}

// Thin passthrough of ManualCaptureForm's imperative API — EventForm's
// single submit button drives the whole "capture a contact" section
// through this ref, without CaptureSection needing to know any of
// ManualCaptureForm's internals itself.
export type CaptureSectionHandle = ManualCaptureFormHandle;

export const CaptureSection = forwardRef<CaptureSectionHandle, CaptureSectionProps>(
  function CaptureSection(
    { eventId, onSaved, onAwaitingReviewChange, onUploadPendingChange },
    ref,
  ) {
  const [imageCapture, setImageCapture] = useState<ImageCaptureState | null>(null);
  const extractMutation = useExtractImageMutation();
  const manualFormRef = useRef<ManualCaptureFormHandle>(null);

  useImperativeHandle(
    ref,
    () => ({
      isEmpty: () => manualFormRef.current?.isEmpty() ?? true,
      validate: () => manualFormRef.current?.validate() ?? true,
      submit: (eventIdOverride) =>
        manualFormRef.current?.submit(eventIdOverride) ?? Promise.resolve(),
    }),
    [],
  );

  // EIF-0002 AC5: a second (replace) upload resets imageCapture to a fresh
  // pending extraction against the new image, discarding the prior result.
  const handleBusinessCardUploaded = useCallback(
    (imageId: string) => {
      setImageCapture({
        imageId,
        status: "extracting",
        fields: {},
        warnings: [],
        captureMethod: null,
      });

      extractMutation.mutate(imageId, {
        onSuccess: (review) => {
          // Guard against a stale response landing after another replace
          // has already started a newer extraction.
          setImageCapture((current) =>
            current && current.imageId === imageId
              ? {
                  imageId,
                  status: review.extraction_status,
                  fields: review.fields,
                  warnings: review.warnings,
                  captureMethod: review.capture_method,
                }
              : current,
          );
        },
        onError: () => {
          // EIF-0001 AC4: a request-level failure (404/502/timeout) is
          // treated the same as an in-band "failed" extraction_status — no
          // fields to autofill, non-blocking, manual entry still works.
          setImageCapture((current) =>
            current && current.imageId === imageId
              ? { ...current, status: "failed" }
              : current,
          );
        },
      });
    },
    [extractMutation],
  );

  // The extraction status is surfaced as a small badge overlaid on the
  // business-card image itself (ImageDropzoneField's statusBadge prop),
  // rather than a separate block underneath it — one visual focal point
  // instead of two. "skipped" gets no badge: EIF-0001 AC5 treats it as a
  // non-event, nothing to call out.
  let statusBadge: React.ReactNode = null;
  let statusCaption: React.ReactNode = null;
  if (imageCapture?.status === "extracting") {
    statusBadge = (
      <span
        role="status"
        className="inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-1 text-xs font-medium text-white backdrop-blur-sm"
      >
        <Loader2 className="size-3 shrink-0 animate-spin" aria-hidden="true" />
        Reading…
      </span>
    );
  } else if (imageCapture?.status === "failed") {
    statusBadge = (
      <span
        role="status"
        className="inline-flex items-center gap-1 rounded-full bg-destructive px-2 py-1 text-xs font-medium text-white"
      >
        <AlertTriangle className="size-3 shrink-0" aria-hidden="true" />
        Couldn&apos;t read card
      </span>
    );
    statusCaption = "You can still enter the contact's details manually.";
  } else if (imageCapture?.status === "completed") {
    const foundFields = Object.keys(imageCapture.fields).length > 0;
    statusBadge = (
      <span
        role="status"
        className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-1 text-xs font-medium text-primary-foreground"
      >
        <CheckCircle2 className="size-3 shrink-0" aria-hidden="true" />
        {foundFields ? "Extracted" : "No fields found"}
      </span>
    );
    statusCaption = foundFields
      ? "Review and edit the fields before saving."
      : "No fields were found — enter the contact's details manually.";
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <div className="w-full lg:max-w-sm space-y-2">
        <ImageCaptureForm
          onBusinessCardUploaded={handleBusinessCardUploaded}
          businessCardStatusBadge={statusBadge}
          businessCardStatusCaption={statusCaption}
          onBusinessCardUploadPendingChange={onUploadPendingChange}
        />

        {imageCapture && imageCapture.warnings.length > 0 && (
          <ul role="status" className="space-y-1 text-sm text-muted-foreground">
            {imageCapture.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        )}
      </div>
      <div className="w-full flex-1 border-t border-border pt-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
        <ManualCaptureForm
          ref={manualFormRef}
          eventId={eventId}
          imageCapture={imageCapture}
          onSaved={onSaved}
          onAwaitingReviewChange={onAwaitingReviewChange}
        />
      </div>
    </div>
  );
  },
);
