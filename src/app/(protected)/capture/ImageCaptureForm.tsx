"use client";

// Requirements: CAP-0006 AC1, AC2, AC3, AC4, AC5, AC6, AC7; CAP-0007 AC1, AC2, AC3
//
// The business-card field below is the MVP-scoped field these requirement
// IDs cover. The Selfie Image field is explicitly out of MVP scope per
// requirements.md's "Out of Scope" section and SRS §3.5 — it exists here
// only because it was added in an earlier, uncommitted edit and the repo
// owner asked to keep it as a real second field rather than remove it, not
// because any CAP-000x/SRS requirement calls for it. Flagged per CLAUDE.md's
// "flag the discrepancy... rather than silently picking one" rule.
import { ImageDropzoneField } from "./ImageDropzoneField";

export interface ImageCaptureFormProps {
  /**
   * EIF-0001 AC1: forwarded only to the business-card field — the selfie
   * field is out of MVP scope (see comment above) and stays fully
   * independent, never triggering extraction.
   */
  onBusinessCardUploaded?: (imageId: string) => void;
  /** Forwarded to the business-card field's `statusBadge` — see CaptureSection. */
  businessCardStatusBadge?: React.ReactNode;
  /** Forwarded to the business-card field's `statusCaption` — see CaptureSection. */
  businessCardStatusCaption?: React.ReactNode;
  /**
   * Forwarded to the business-card field's `onUploadPendingChange` only —
   * the selfie field never blocks submission since it doesn't feed
   * extraction and isn't part of the contact-capture contract.
   */
  onBusinessCardUploadPendingChange?: (isPending: boolean) => void;
}

export function ImageCaptureForm({
  onBusinessCardUploaded,
  businessCardStatusBadge,
  businessCardStatusCaption,
  onBusinessCardUploadPendingChange,
}: ImageCaptureFormProps) {
  return (
    <div className="space-y-6">
      <ImageDropzoneField
        id="capture-image-business-card"
        label="Business card image"
        required
        dropText="Drag and drop a business card image here"
        onUploadSuccess={onBusinessCardUploaded}
        statusBadge={businessCardStatusBadge}
        statusCaption={businessCardStatusCaption}
        onUploadPendingChange={onBusinessCardUploadPendingChange}
      />
      <ImageDropzoneField
        id="capture-image-selfie"
        label="Selfie Image"
        dropText="Drag and drop a selfie image here"
      />
    </div>
  );
}
