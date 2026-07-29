"use client";

// A single self-contained drag-and-drop image field: its own selection
// state, preview, and upload mutation. Extracted so ImageCaptureForm can
// render the business-card field (in MVP scope, CAP-0006/CAP-0007) and the
// selfie field (explicitly out of MVP scope per requirements.md, kept only
// because the user asked for it as a real second field) as two fully
// independent instances, rather than two copies sharing one dropzone/id
// (the previous version's bug — both fields used the same input id, which
// silently broke label association and file selection for one of them).
import { useCallback, useEffect, useState } from "react";
import { FileRejection, useDropzone, type FileError } from "react-dropzone";
import { CheckCircle2, ImageUp, Loader2, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useUploadImageMutation } from "@/lib/api/images.hooks";

const ACCEPTED_TYPES = ["image/jpeg", "image/png"] as const;
type AcceptedType = (typeof ACCEPTED_TYPES)[number];

const MAX_BYTES = 5 * 1024 * 1024;

const OVERSIZE_MESSAGE = "This image is larger than 5 MB. Choose a smaller JPEG or PNG.";
const INVALID_TYPE_MESSAGE = "Choose a JPEG or PNG image.";
const UPLOAD_FAILED_MESSAGE = "The upload failed. Try again.";

function isAcceptedType(type: string): type is AcceptedType {
  return (ACCEPTED_TYPES as readonly string[]).includes(type);
}

function formatBytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function imageValidator(file: File): FileError | FileError[] | null {
  const errors: FileError[] = [];

  if (!isAcceptedType(file.type)) {
    errors.push({ code: "file-invalid-type", message: INVALID_TYPE_MESSAGE });
  }
  if (file.size > MAX_BYTES) {
    errors.push({ code: "file-too-large", message: OVERSIZE_MESSAGE });
  }

  return errors.length > 0 ? errors : null;
}

export interface ImageDropzoneFieldProps {
  /** Unique per-field id — must not collide with any other field on the page. */
  id: string;
  label: string;
  required?: boolean;
  dropText: string;
  /**
   * EIF-0001 AC1: fired once with the new image_id each time an upload
   * succeeds (including a Replace/retry that succeeds), so a parent can
   * chain extraction. Not fired on failure/cancel.
   */
  onUploadSuccess?: (imageId: string) => void;
  /**
   * Optional small pill rendered as an overlay in the top-right corner of
   * the uploaded preview — used by CaptureSection to surface extraction
   * status (reading/failed/extracted) directly on the business-card image
   * rather than as a separate block underneath it.
   */
  statusBadge?: React.ReactNode;
  /**
   * Optional short caption rendered under the uploaded preview, below the
   * "Image uploaded" row — used for a one-line explanation that accompanies
   * `statusBadge` (e.g. what to do next after a failed/completed extraction).
   */
  statusCaption?: React.ReactNode;
  /**
   * Fired whenever the upload's in-flight state changes. Lets a parent
   * (CaptureSection, for the business-card field) block form submission
   * while an upload is still running — otherwise the image_id this field
   * will eventually report never makes it into the submit, and the
   * in-progress upload is silently abandoned.
   */
  onUploadPendingChange?: (isPending: boolean) => void;
}

export function ImageDropzoneField({
  id,
  label,
  required,
  dropText,
  onUploadSuccess,
  statusBadge,
  statusCaption,
  onUploadPendingChange,
}: ImageDropzoneFieldProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const upload = useUploadImageMutation();

  // EIF-0001 AC1: report each successful upload's image_id upward. Keyed on
  // the returned image_id (not just upload.isSuccess) so a second upload of
  // a different file — a new, distinct id — reliably re-fires even though
  // isSuccess was already true from the first one.
  const uploadedImageId = upload.data?.image_id;
  useEffect(() => {
    if (upload.isSuccess && uploadedImageId) {
      onUploadSuccess?.(uploadedImageId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onUploadSuccess is intentionally not a dep: callers pass a fresh inline closure each render, and re-running this effect only on isSuccess/uploadedImageId changes is what "fires once per successful upload" requires.
  }, [upload.isSuccess, uploadedImageId]);

  useEffect(() => {
    onUploadPendingChange?.(upload.isPending);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onUploadPendingChange is intentionally not a dep, same reasoning as onUploadSuccess above: notify only when isPending actually transitions.
  }, [upload.isPending]);

  const clearPreview = useCallback(() => {
    setPreviewUrl((currentUrl) => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }
      return null;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const startUpload = useCallback(
    (file: File, contentType: AcceptedType) => {
      upload.mutate({ file, contentType });
    },
    [upload],
  );

  const handleAcceptedFiles = useCallback(
    (files: File[]) => {
      const file = files[0];

      upload.reset();
      setFieldError(null);
      clearPreview();

      if (!file || !isAcceptedType(file.type)) {
        setSelectedFile(null);
        setFieldError(INVALID_TYPE_MESSAGE);
        return;
      }

      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      startUpload(file, file.type);
    },
    [clearPreview, startUpload, upload],
  );

  const handleRejectedFiles = useCallback(
    (rejections: FileRejection[]) => {
      upload.reset();
      setSelectedFile(null);
      clearPreview();

      // react-dropzone's own `accept`-mismatch error carries a generic,
      // library-generated message ("File type must be one of ...") that
      // would otherwise override our copy — map by error code instead of
      // trusting the message text, so both dropzone's built-in check and
      // our own imageValidator produce the same user-facing wording.
      const firstError = rejections[0]?.errors[0];
      if (firstError?.code === "file-too-large") {
        setFieldError(OVERSIZE_MESSAGE);
        return;
      }
      setFieldError(INVALID_TYPE_MESSAGE);
    },
    [clearPreview, upload],
  );

  const { getRootProps, getInputProps, inputRef, isDragActive, isDragAccept, isDragReject } =
    useDropzone({
      accept: { "image/jpeg": [".jpg", ".jpeg"], "image/png": [".png"] },
      maxFiles: 1,
      multiple: false,
      validator: imageValidator,
      disabled: upload.isPending,
      onDropAccepted: handleAcceptedFiles,
      onDropRejected: handleRejectedFiles,
    });

  function resetFileInput() {
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  // CAP-0007 AC2: abort the in-flight upload and return to the pre-upload
  // picker state — no partial image is left submitted.
  function handleCancel() {
    upload.abort();
    upload.reset();
    setSelectedFile(null);
    setFieldError(null);
    clearPreview();
    resetFileInput();
  }

  // CAP-0007 AC3: re-attempt using the already-selected file, requesting a
  // fresh signed URL (useUploadImageMutation calls requestUploadUrl again
  // on every mutate()) — no re-selection required.
  function handleRetry() {
    if (!selectedFile || !isAcceptedType(selectedFile.type)) {
      return;
    }
    upload.reset();
    startUpload(selectedFile, selectedFile.type);
  }

  function handleReset() {
    upload.reset();
    setSelectedFile(null);
    setFieldError(null);
    clearPreview();
    resetFileInput();
  }

  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  const showDropzone = !upload.isSuccess;

  const dropzoneStateClass = isDragReject
    ? "border-destructive bg-destructive/5"
    : isDragAccept
      ? "border-primary bg-primary/5"
      : isDragActive
        ? "border-primary bg-muted/60"
        : fieldError
          ? "border-destructive/60 bg-destructive/5"
          : "border-border bg-muted/30 hover:border-primary/60 hover:bg-muted/50";

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}{" "}
        {required ? (
          <span className="text-destructive">*</span>
        ) : (
          <span className="text-muted-foreground">(Optional)</span>
        )}
      </Label>

      {showDropzone && (
        <div
          {...getRootProps({
            className: [
              "relative flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors",
              dropzoneStateClass,
              upload.isPending ? "cursor-not-allowed opacity-75" : "",
            ]
              .filter(Boolean)
              .join(" "),
            role: "button",
            "aria-label": `Upload ${label.toLowerCase()}`,
            "aria-invalid": Boolean(fieldError),
            "aria-describedby": fieldError ? errorId : helpId,
          })}
        >
          <input {...getInputProps({ id, "data-testid": `${id}-input` })} />

          {upload.isPending ? (
            <>
              <Loader2 className="mb-3 size-8 animate-spin text-primary" aria-hidden="true" />
              <p className="text-sm font-medium">Uploading {selectedFile?.name}…</p>
              <div
                role="progressbar"
                aria-valuenow={upload.progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${label} upload progress`}
                className="mt-3 h-1.5 w-full max-w-56 overflow-hidden rounded-full bg-muted"
              >
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${upload.progress}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{upload.progress}%</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCancel();
                }}
              >
                Cancel
              </Button>
            </>
          ) : previewUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview, not a remote/optimizable image */}
              <img
                src={previewUrl}
                alt={`Preview of ${selectedFile?.name ?? "selected image"}`}
                className="mb-3 max-h-40 max-w-full rounded-md object-contain shadow-sm"
              />
              <p className="max-w-full truncate text-sm font-medium">{selectedFile?.name}</p>
              {selectedFile && (
                <p className="text-xs text-muted-foreground">{formatBytes(selectedFile.size)}</p>
              )}
            </>
          ) : (
            <>
              <div
                className="mb-3 flex size-12 items-center justify-center rounded-full bg-background shadow-sm"
                aria-hidden="true"
              >
                <ImageUp className="size-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">{isDragActive ? "Drop the image here" : dropText}</p>
              <p id={helpId} className="mt-1 text-sm text-muted-foreground">
                Click to browse. JPEG or PNG, up to 5 MB.
              </p>
            </>
          )}
        </div>
      )}

      {fieldError && (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {fieldError}
        </p>
      )}

      {upload.isError && (
        <div className="flex flex-wrap items-center gap-2.5">
          <p role="alert" className="text-sm text-destructive">
            {UPLOAD_FAILED_MESSAGE}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={handleRetry}>
              <RotateCcw className="size-3.5" />
              Retry
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={handleReset}>
              <X className="size-3.5" />
              Choose Another
            </Button>
          </div>
        </div>
      )}

      {upload.isSuccess && (
        <div
          role="status"
          data-testid={`${id}-success`}
          className="space-y-2.5 rounded-lg border border-border bg-muted/30 p-3"
        >
          {previewUrl && (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
              <img
                src={previewUrl}
                alt={`Uploaded ${selectedFile?.name ?? "image"}`}
                className="h-56 w-full rounded-md object-cover shadow-sm"
              />
              {statusBadge && (
                <div className="absolute right-2 top-2">{statusBadge}</div>
              )}
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <CheckCircle2 className="size-4 shrink-0 text-primary" aria-hidden="true" />
                Image uploaded
              </p>
              <p className="truncate text-xs text-muted-foreground">
                Reference: {upload.data.image_id}
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={handleReset}>
              Replace
            </Button>
          </div>
          {statusCaption && (
            <p className="text-xs text-muted-foreground">{statusCaption}</p>
          )}
        </div>
      )}
    </div>
  );
}
