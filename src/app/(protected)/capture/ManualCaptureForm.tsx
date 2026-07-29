"use client";

// Requirements: CAP-0001 AC1, AC2, AC3, AC4; CAP-0002 AC1-AC6; CAP-0003 AC1,
// AC2; CAP-0004 AC1, AC2, AC3, AC4; CAP-0005 AC1, AC2, AC3
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateContactMutation, useResolveContactMutation } from "@/lib/api/contacts.hooks";
import type { ContactInput, ResolveResult } from "@/lib/api/contacts.types";
import { generateIdempotencyKey } from "@/lib/api/idempotency-key";
import { SessionExpiredError } from "@/lib/api/axiosClient";
import { SESSION_EXPIRED_MESSAGE } from "@/lib/api/session-expired";
import { ImagesApiError } from "@/lib/api/images";
import { useConfirmImageMutation } from "@/lib/api/images.hooks";
import type { ExtractableFieldName } from "@/lib/api/images.types";
import { CaptureSuccess } from "./CaptureSuccess";
import { DuplicateReview } from "./DuplicateReview";
import type { ImageCaptureState } from "./CaptureSection";

const NAME_MAX = 100;
const SHORT_FIELD_MAX = 150;
const ADDRESS_MAX = 500;
const NOTES_MAX = 2000;
const PHONE_OR_EMAIL_REQUIRED_MESSAGE = "Enter a valid phone number or email address.";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_PATTERN = /^https?:\/\/.+/i;

interface FieldErrors {
  firstName?: string;
  lastName?: string;
  company?: string;
  position?: string;
  website?: string;
  email?: string;
  address?: string;
  notes?: string;
  phoneOrEmail?: string;
}

type Step = "form" | "duplicate" | "ambiguous" | "success";

interface ManualCaptureFormProps {
  // Optional so this form can be embedded where no event exists yet (e.g.
  // the event-create form) — saving is blocked with a clear message until
  // a real event id is available, rather than calling the event-scoped
  // create endpoint with an invalid/empty id. `submit()`'s eventIdOverride
  // (below) covers the create-mode case where a real id becomes available
  // synchronously, in the same submit, before it could round-trip back
  // down as this prop.
  eventId?: string;
  // EIF-0002/EIF-0003: the current extraction result from CaptureSection,
  // if a business-card image is part of this capture session. Drives
  // autofill (EIF-0002) and, when set, routes submission through the
  // image-confirm pipeline instead of plain create (EIF-0003).
  imageCapture?: ImageCaptureState | null;
  // Called once this capture reaches a real, final success — either
  // immediately (no_match) or after the user confirms a duplicate-review
  // step. The single-submit-button flow (EventForm) uses this to know when
  // it's safe to navigate away.
  onSaved?: () => void;
  // Fires whenever this form parks on a step that requires the user's own
  // action here (duplicate/ambiguous review) and again when it leaves one.
  // A caller with its own primary submit button (EventForm, the standalone
  // capture page) uses this to disable that button for the duration —
  // `submit()`'s returned promise already resolves once a review step is
  // reached (it doesn't wait for the user to act on it), so `submitting`
  // state alone isn't enough to prevent a second click from re-running the
  // whole outer submit handler (and, in create mode, creating a second
  // event) while this review UI is still showing.
  onAwaitingReviewChange?: (awaitingReview: boolean) => void;
}

// This component no longer owns a visible submit button or a <form> of its
// own (EventForm's single submit button drives everything via this handle)
// — see EventForm.tsx's handleSubmit for the orchestration this supports.
export interface ManualCaptureFormHandle {
  /** True when every field is blank and no image is part of this session. */
  isEmpty: () => boolean;
  /** Runs client-side validation, surfacing field errors; returns whether valid. */
  validate: () => boolean;
  /**
   * Runs the same resolve/confirm → create flow the old "Save Contact"
   * button triggered. `eventIdOverride`, if given, is used instead of (and
   * updates) this component's own `eventId` prop — needed in create mode,
   * where a brand-new event's id is only known synchronously inside the
   * caller's submit handler, one render before it could arrive back down
   * as a prop.
   */
  submit: (eventIdOverride?: string) => Promise<void>;
}

const MAPPABLE_FIELDS: Record<ExtractableFieldName, true> = {
  first_name: true,
  last_name: true,
  company: true,
  position: true,
  phone: true,
  email: true,
  website: true,
  address: true,
};

const NO_EVENT_MESSAGE = "Select or create an event before saving this contact.";

function normalizeEmail(email: string): string {
  const trimmed = email.trim();
  const atIndex = trimmed.lastIndexOf("@");
  if (atIndex === -1) {
    return trimmed;
  }
  return `${trimmed.slice(0, atIndex)}@${trimmed.slice(atIndex + 1).toLowerCase()}`;
}

export const ManualCaptureForm = forwardRef<ManualCaptureFormHandle, ManualCaptureFormProps>(
  function ManualCaptureForm({ eventId, imageCapture, onSaved, onAwaitingReviewChange }, ref) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [company, setCompany] = useState("");
  const [position, setPosition] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("form");
  const [resolveResult, setResolveResult] = useState<ResolveResult | null>(null);

  // Notify the caller's own submit button whenever this form parks on a
  // step that needs the user's action here — see onAwaitingReviewChange's
  // doc above for why `submitting` alone doesn't cover this window.
  useEffect(() => {
    onAwaitingReviewChange?.(step === "duplicate" || step === "ambiguous");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onAwaitingReviewChange is intentionally not a dep: callers pass a fresh inline closure (e.g. setState) each render, and re-running this effect only when `step` actually changes is what "notify on transition" requires.
  }, [step]);

  // CAP-0005: one key per submission attempt, reused across a retry of the
  // same attempt, cleared whenever the user edits a field so the next
  // submit is treated as a new attempt (design.md Decisions).
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const [attemptInput, setAttemptInput] = useState<ContactInput | null>(null);
  const [syncStatus, setSyncStatus] = useState<"pending" | "synced" | "failed">("pending");

  const resolveMutation = useResolveContactMutation();
  const createMutation = useCreateContactMutation();
  const confirmMutation = useConfirmImageMutation();

  const submitting = resolveMutation.isPending || createMutation.isPending || confirmMutation.isPending;

  // The event id actually used by a save. Starts in sync with the `eventId`
  // prop but can be overridden synchronously by `submit(eventIdOverride)`
  // (see ManualCaptureFormHandle) — a ref, not state, so the override takes
  // effect immediately within the same call rather than waiting a render.
  // Safe only because callers never re-render this component with a changed
  // `eventId` prop after a create-mode submit (EventForm's `initialEvent`
  // stays undefined throughout, so this prop is stable) — the real id only
  // ever arrives via `submit(eventIdOverride)`. If a caller starts reflecting
  // the newly-created event id back down as a prop, this effect would fire
  // after the override and could race with it.
  const eventIdRef = useRef(eventId);
  useEffect(() => {
    eventIdRef.current = eventId;
  }, [eventId]);

  // EIF-0002 AC2, AC5: a mappable field the user has edited themselves is
  // never overwritten by autofill again, whether from the current
  // extraction or a later one after the image is replaced. Plain state
  // (not a ref) — react-hooks/refs flags any ref dereferenced inside a
  // closure built during render, which `field()` below necessarily is,
  // even though that closure only ever actually runs from an onChange
  // event.
  const [touchedFields, setTouchedFields] = useState<Set<ExtractableFieldName>>(() => new Set());

  // EIF-0002 AC1-AC2, AC5: apply extraction's fields to any untouched
  // mappable input. A field present in `fields` gets that value; a field
  // absent gets cleared to "" ONLY because it's untouched — for an
  // untouched field, "current value" can only be either the pristine ""
  // or a prior autofill's value, both of which are correct to overwrite on
  // a fresh completed extraction (this is what makes image-replace clear
  // stale autofill per AC5, without touching anything the user typed).
  useEffect(() => {
    if (!imageCapture || imageCapture.status !== "completed") {
      return;
    }
    const setters: Record<ExtractableFieldName, (value: string) => void> = {
      first_name: setFirstName,
      last_name: setLastName,
      company: setCompany,
      position: setPosition,
      phone: setPhone,
      email: setEmail,
      website: setWebsite,
      address: setAddress,
    };
    (Object.keys(MAPPABLE_FIELDS) as ExtractableFieldName[]).forEach((name) => {
      if (touchedFields.has(name)) {
        return;
      }
      const extracted = imageCapture.fields[name];
      setters[name](extracted ? extracted.value : "");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally keyed on imageId+status only: the setters are stable useState setters, and re-running this effect on every `imageCapture.fields`/`touchedFields` identity change (even when imageId/status haven't changed) is not what "apply once per completed extraction" requires — it should use whatever the current touched set is at that moment, not re-fire because the set changed.
  }, [imageCapture?.imageId, imageCapture?.status]);

  function resetAttempt() {
    setIdempotencyKey(null);
    setAttemptInput(null);
  }

  function field(setter: (value: string) => void, name?: ExtractableFieldName) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setter(e.target.value);
      if (name) {
        setTouchedFields((prev) => (prev.has(name) ? prev : new Set(prev).add(name)));
      }
      // Any edit invalidates the in-flight attempt's key — CAP-0005 AC3.
      resetAttempt();
    };
  }

  function validate(): ContactInput | null {
    const errors: FieldErrors = {};

    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();
    if (trimmedFirstName.length < 1 || trimmedFirstName.length > NAME_MAX) {
      errors.firstName = `Enter a first name between 1 and ${NAME_MAX} characters.`;
    }
    if (trimmedLastName.length < 1 || trimmedLastName.length > NAME_MAX) {
      errors.lastName = `Enter a last name between 1 and ${NAME_MAX} characters.`;
    }

    if (company.trim().length > SHORT_FIELD_MAX) {
      errors.company = `Company must be ${SHORT_FIELD_MAX} characters or fewer.`;
    }
    if (position.trim().length > SHORT_FIELD_MAX) {
      errors.position = `Position must be ${SHORT_FIELD_MAX} characters or fewer.`;
    }
    if (address.trim().length > ADDRESS_MAX) {
      errors.address = `Address must be ${ADDRESS_MAX} characters or fewer.`;
    }
    if (notes.trim().length > NOTES_MAX) {
      errors.notes = `Notes must be ${NOTES_MAX} characters or fewer.`;
    }

    const trimmedWebsite = website.trim();
    if (trimmedWebsite && !URL_PATTERN.test(trimmedWebsite)) {
      errors.website = "Enter a valid http:// or https:// website URL.";
    }

    const trimmedEmail = email.trim();
    let normalizedEmail = "";
    if (trimmedEmail) {
      if (!EMAIL_PATTERN.test(trimmedEmail)) {
        errors.email = "Enter a valid email address.";
      } else {
        normalizedEmail = normalizeEmail(trimmedEmail);
      }
    }

    const trimmedPhone = phone.trim();
    // CAP-0002 AC5: at least one of phone/email is required.
    if (!trimmedPhone && !normalizedEmail) {
      errors.phoneOrEmail = PHONE_OR_EMAIL_REQUIRED_MESSAGE;
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return null;
    }

    return {
      first_name: trimmedFirstName,
      last_name: trimmedLastName,
      ...(company.trim() ? { company: company.trim() } : {}),
      ...(position.trim() ? { position: position.trim() } : {}),
      ...(trimmedPhone ? { phone: trimmedPhone } : {}),
      ...(normalizedEmail ? { email: normalizedEmail } : {}),
      ...(trimmedWebsite ? { website: trimmedWebsite } : {}),
      ...(address.trim() ? { address: address.trim() } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    };
  }

  function handleError(err: unknown) {
    if (err instanceof SessionExpiredError) {
      // CAP-0003 AC2: the shared apiClient interceptor already redirects to
      // /login; this message covers the moment before that takes effect.
      setFormError(SESSION_EXPIRED_MESSAGE);
      return;
    }
    setFormError(err instanceof Error ? err.message : "Something went wrong.");
  }

  async function saveContact(input: ContactInput, key: string) {
    const currentEventId = eventIdRef.current;
    if (!currentEventId) {
      setFormError(NO_EVENT_MESSAGE);
      return;
    }
    try {
      const result = await createMutation.mutateAsync({
        eventId: currentEventId,
        input,
        idempotencyKey: key,
      });
      setSyncStatus(result.occurrence.ghl_sync_status);
      setStep("success");
      onSaved?.();
    } catch (err) {
      // CAP-0001 AC4: preserve input, keep the key/attempt so Retry reuses it.
      handleError(err);
    }
  }

  // EIF-0003 AC1, AC3, AC4, AC5: persist via the image-confirm pipeline
  // instead of plain create, when this capture session has an image
  // (regardless of whether extraction itself succeeded — EIF-0003 AC1's
  // "successfully or not extracted"). No separate dry-run resolve step
  // exists for this path (design.md Decision) — only the ambiguous case is
  // caught here; a plain phone/email match is auto-resolved server-side.
  async function confirmAndSave(
    input: ContactInput,
    key: string,
    imageId: string,
    captureMethod: "image" | "qr" | "mixed",
  ) {
    const currentEventId = eventIdRef.current;
    if (!currentEventId) {
      setFormError(NO_EVENT_MESSAGE);
      return;
    }
    try {
      const result = await confirmMutation.mutateAsync({
        imageId,
        input: { event_id: currentEventId, capture_method: captureMethod, ...input },
        idempotencyKey: key,
      });
      setSyncStatus(result.occurrence.ghl_sync_status);
      setStep("success");
      onSaved?.();
    } catch (err) {
      if (err instanceof ImagesApiError && err.code === "AMBIGUOUS_DUPLICATE") {
        setStep("ambiguous");
        return;
      }
      handleError(err);
    }
  }

  async function resolveAndProceed(input: ContactInput, key: string) {
    try {
      // Real ResolveRequest only takes phone/email (Task 7 verification).
      const result = await resolveMutation.mutateAsync({
        phone: input.phone,
        email: input.email,
      });
      setResolveResult(result);
      if (result.match === "ambiguous") {
        // CAP-0004 AC3: no auto-merge, no auto-select — block and route to
        // Admin review.
        setStep("ambiguous");
        return;
      }
      if (result.match === "no_match") {
        await saveContact(input, key);
        return;
      }
      // Contract guard: a phone_match/email_match with no contact would be
      // a backend contract violation (design.md's ResolveResult always
      // pairs a match with its contact) — treat it as an error rather than
      // rendering DuplicateReview with a null contact, which would throw.
      if (!result.contact) {
        setFormError("Something went wrong reviewing this match. Try again.");
        return;
      }
      setStep("duplicate");
    } catch (err) {
      handleError(err);
    }
  }

  // Shared by the imperative handle's submit() — this component no longer
  // has its own <form>/submit button (EventForm's single button triggers
  // this via the ref instead).
  async function runSubmit(eventIdOverride?: string): Promise<void> {
    if (eventIdOverride) {
      eventIdRef.current = eventIdOverride;
    }
    setFormError(null);

    const validated = validate();
    if (!validated) {
      return;
    }

    const key = idempotencyKey ?? generateIdempotencyKey();
    setIdempotencyKey(key);
    setAttemptInput(validated);

    // EIF-0003 AC2: only the confirm path when an image is actually part of
    // this session — if it was removed/never uploaded, this is unchanged
    // from the existing plain-create behavior.
    if (imageCapture?.imageId) {
      await confirmAndSave(
        validated,
        key,
        imageCapture.imageId,
        imageCapture.captureMethod ?? "image",
      );
      return;
    }
    await resolveAndProceed(validated, key);
  }

  useImperativeHandle(
    ref,
    () => ({
      isEmpty: () =>
        [firstName, lastName, company, position, phone, email, website, address, notes].every(
          (value) => value.trim().length === 0,
        ) && !imageCapture?.imageId,
      validate: () => validate() !== null,
      submit: (eventIdOverride) => runSubmit(eventIdOverride),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally re-created on every render (cheap closures) rather than hand-maintaining an exhaustive dep list across every field this reads.
    [firstName, lastName, company, position, phone, email, website, address, notes, imageCapture],
  );

  function handleConfirmDuplicate() {
    if (!attemptInput || !idempotencyKey) {
      return;
    }
    void saveContact(attemptInput, idempotencyKey);
  }

  function handleCancelDuplicate() {
    setStep("form");
  }

  // Retries the same attempt (same idempotency key, same values) after a
  // resolve/save failure — CAP-0005 AC2: no new key, since nothing changed.
  function handleRetry() {
    if (!attemptInput || !idempotencyKey) {
      return;
    }
    setFormError(null);
    if (imageCapture?.imageId) {
      void confirmAndSave(
        attemptInput,
        idempotencyKey,
        imageCapture.imageId,
        imageCapture.captureMethod ?? "image",
      );
      return;
    }
    void resolveAndProceed(attemptInput, idempotencyKey);
  }

  if (step === "success") {
    return <CaptureSuccess syncStatus={syncStatus} />;
  }

  if (
    step === "duplicate" &&
    resolveResult &&
    resolveResult.contact &&
    (resolveResult.match === "phone_match" || resolveResult.match === "email_match") &&
    attemptInput
  ) {
    return (
      <DuplicateReview
        resolution={resolveResult.match}
        matched={resolveResult.contact}
        incoming={attemptInput}
        onConfirm={handleConfirmDuplicate}
        onCancel={handleCancelDuplicate}
        confirming={createMutation.isPending}
      />
    );
  }

  if (step === "ambiguous") {
    return (
      <div role="alert" className="space-y-2" data-testid="ambiguous-review">
        <p className="text-sm font-medium">This contact needs Admin review.</p>
        <p className="text-sm text-muted-foreground">
          Matching phone and email values point to different existing contacts, or more than one
          contact matches. An Admin must resolve this before it can be saved.
        </p>
        <Button type="button" variant="outline" onClick={() => setStep("form")}>
          Back to Form
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="contact-first-name">First name</Label>
        <Input
          id="contact-first-name"
          value={firstName}
          onChange={field(setFirstName, "first_name")}
          aria-invalid={Boolean(fieldErrors.firstName)}
          aria-describedby={fieldErrors.firstName ? "contact-first-name-error" : undefined}
          disabled={submitting}
        />
        {fieldErrors.firstName && (
          <p id="contact-first-name-error" className="text-sm text-destructive">
            {fieldErrors.firstName}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="contact-last-name">Last name</Label>
        <Input
          id="contact-last-name"
          value={lastName}
          onChange={field(setLastName, "last_name")}
          aria-invalid={Boolean(fieldErrors.lastName)}
          aria-describedby={fieldErrors.lastName ? "contact-last-name-error" : undefined}
          disabled={submitting}
        />
        {fieldErrors.lastName && (
          <p id="contact-last-name-error" className="text-sm text-destructive">
            {fieldErrors.lastName}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="contact-company">Company</Label>
        <Input
          id="contact-company"
          value={company}
          onChange={field(setCompany, "company")}
          aria-invalid={Boolean(fieldErrors.company)}
          aria-describedby={fieldErrors.company ? "contact-company-error" : undefined}
          disabled={submitting}
        />
        {fieldErrors.company && (
          <p id="contact-company-error" className="text-sm text-destructive">
            {fieldErrors.company}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="contact-position">Position</Label>
        <Input
          id="contact-position"
          value={position}
          onChange={field(setPosition, "position")}
          aria-invalid={Boolean(fieldErrors.position)}
          aria-describedby={fieldErrors.position ? "contact-position-error" : undefined}
          disabled={submitting}
        />
        {fieldErrors.position && (
          <p id="contact-position-error" className="text-sm text-destructive">
            {fieldErrors.position}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="contact-phone">Phone</Label>
        <Input
          id="contact-phone"
          type="tel"
          value={phone}
          onChange={field(setPhone, "phone")}
          disabled={submitting}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="contact-email">Email</Label>
        <Input
          id="contact-email"
          type="email"
          value={email}
          onChange={field(setEmail, "email")}
          aria-invalid={Boolean(fieldErrors.email)}
          aria-describedby={fieldErrors.email ? "contact-email-error" : undefined}
          disabled={submitting}
        />
        {fieldErrors.email && (
          <p id="contact-email-error" className="text-sm text-destructive">
            {fieldErrors.email}
          </p>
        )}
      </div>

      {fieldErrors.phoneOrEmail && (
        <p role="alert" className="text-sm text-destructive">
          {fieldErrors.phoneOrEmail}
        </p>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="contact-website">Website</Label>
        <Input
          id="contact-website"
          value={website}
          onChange={field(setWebsite, "website")}
          aria-invalid={Boolean(fieldErrors.website)}
          aria-describedby={fieldErrors.website ? "contact-website-error" : undefined}
          disabled={submitting}
        />
        {fieldErrors.website && (
          <p id="contact-website-error" className="text-sm text-destructive">
            {fieldErrors.website}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="contact-address">Address</Label>
        <Input
          id="contact-address"
          value={address}
          onChange={field(setAddress, "address")}
          aria-invalid={Boolean(fieldErrors.address)}
          aria-describedby={fieldErrors.address ? "contact-address-error" : undefined}
          disabled={submitting}
        />
        {fieldErrors.address && (
          <p id="contact-address-error" className="text-sm text-destructive">
            {fieldErrors.address}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="contact-notes">Occurrence notes</Label>
        <textarea
          id="contact-notes"
          value={notes}
          onChange={field(setNotes)}
          aria-invalid={Boolean(fieldErrors.notes)}
          aria-describedby={fieldErrors.notes ? "contact-notes-error" : undefined}
          disabled={submitting}
          rows={4}
          className="w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
        />
        {fieldErrors.notes && (
          <p id="contact-notes-error" className="text-sm text-destructive">
            {fieldErrors.notes}
          </p>
        )}
      </div>

      {formError && (
        <div className="space-y-1.5">
          <p role="alert" className="text-sm text-destructive">
            {formError}
          </p>
          {attemptInput && idempotencyKey && (
            <Button type="button" variant="outline" onClick={handleRetry} disabled={submitting}>
              Retry
            </Button>
          )}
        </div>
      )}
    </div>
  );
  },
);
