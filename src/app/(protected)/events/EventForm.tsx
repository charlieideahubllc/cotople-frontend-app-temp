"use client";

// Requirements: EVT-0002 AC1, AC2, AC5; EVT-0003 AC1, AC2, AC3, AC4, AC5
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { DateTimePicker } from "@/components/ui/datetime-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CreateEventInput, Event, UpdateEventInput } from "@/lib/api/events.types";
import { CaptureSection, type CaptureSectionHandle } from "../capture/CaptureSection";

const NAME_MIN = 2;
const NAME_MAX = 150;
const LOCATION_MAX = 255;
const NOTES_MAX = 2000;

interface EventFormProps {
  mode: "create" | "edit";
  initialEvent?: Event;
  // Returns the saved Event so a freshly-created event's id can be handed
  // straight to the "capture a contact" section in the same submit — see
  // handleSubmit below. Navigation is NOT done inside onSubmit anymore
  // (moved to onSaved) since it must wait for the optional contact save to
  // finish too, not just the event.
  onSubmit: (input: CreateEventInput | UpdateEventInput) => Promise<Event>;
  // Called once the whole submit is done: immediately if the capture
  // section was left empty, or once ManualCaptureForm reports its own
  // save succeeded (which may be after a duplicate-review confirmation).
  onSaved?: () => void;
}

interface FieldErrors {
  name?: string;
  startsAt?: string;
  location?: string;
  notes?: string;
}

// datetime-local inputs use local time with no timezone suffix. Converting
// a UTC ISO string to that format for pre-fill requires reading the Date's
// local components directly — .toISOString() would produce UTC values,
// which would silently shift the displayed time for non-UTC users.
function toDatetimeLocalValue(isoUtc: string): string {
  const d = new Date(isoUtc);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// EVT-0003 AC4: the value collected is local time; what's sent over the
// wire must be UTC ISO 8601. `new Date(localString)` parses a
// timezone-less string as local time, so .toISOString() here correctly
// converts it to UTC.
function fromDatetimeLocalValue(local: string): string | null {
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  return d.toISOString();
}

// Scrolls to and focuses the first invalid field in document order —
// covers both the event's own fields and the contact section's fields
// (both use the same `aria-invalid` pattern), whichever comes first. A
// macrotask delay lets React flush the `aria-invalid`/error-message state
// updates that just happened (in the same synchronous validate() call)
// before this queries the DOM — without it, the query could still see the
// pre-validation attributes.
function scrollToFirstInvalidField(container: HTMLElement | null) {
  if (!container) {
    return;
  }
  setTimeout(() => {
    // Falls back to the first `role="alert"` message for errors that
    // aren't tied to one specific input's aria-invalid — e.g.
    // ManualCaptureForm's combined "enter a phone or email" message, which
    // isn't attached to either the phone or the email field individually.
    const target = container.querySelector<HTMLElement>(
      '[aria-invalid="true"], [role="alert"]',
    );
    // jsdom (this repo's test environment) doesn't implement
    // scrollIntoView at all — guard rather than assume every DOM
    // implementation has it.
    if (typeof target?.scrollIntoView === "function") {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    // preventScroll: true — without it, focusing an off-screen element
    // triggers the browser's own instant jump-to-focus, which fights the
    // smooth scrollIntoView animation above and makes it look like it
    // snaps instead of gliding. A no-op if target isn't natively focusable
    // (e.g. the role="alert" fallback, a <p>) — scrollIntoView already did
    // the work in that case.
    target?.focus({ preventScroll: true });
  }, 0);
}

export function EventForm({ mode, initialEvent, onSubmit, onSaved }: EventFormProps) {
  const captureRef = useRef<CaptureSectionHandle>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [name, setName] = useState(initialEvent?.name ?? "");
  const [startsAt, setStartsAt] = useState(() =>
    initialEvent
      ? toDatetimeLocalValue(initialEvent.starts_at)
      : toDatetimeLocalValue(new Date().toISOString()),
  );
  const [location, setLocation] = useState(initialEvent?.location ?? "");
  const [notes, setNotes] = useState(initialEvent?.notes ?? "");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // True while the capture section is parked on its own duplicate/ambiguous
  // review step, waiting on the user there — `submit()`'s promise already
  // resolved by that point (it doesn't wait for the review to be acted on),
  // so `submitting` alone doesn't cover this window. Without this, a second
  // click on this button while that review is showing would re-run the
  // whole handler, including creating a second event in create mode.
  const [awaitingContactReview, setAwaitingContactReview] = useState(false);
  // True while the business-card image is still uploading. isEmpty() only
  // looks at manual field values and a *finished* upload's imageId, so
  // without this a submit mid-upload would see the contact section as
  // unused and proceed without it, silently abandoning the in-flight image.
  const [contactImageUploadPending, setContactImageUploadPending] = useState(false);
  const contactSubmitBlocked = awaitingContactReview || contactImageUploadPending;

  function validate(): { startsAtUtc: string } | null {
    const errors: FieldErrors = {};
    const trimmedName = name.trim();

    if (!trimmedName) {
      errors.name = "Event name is required.";
    } else if (trimmedName.length < NAME_MIN || trimmedName.length > NAME_MAX) {
      errors.name = `Enter a name between ${NAME_MIN} and ${NAME_MAX} characters.`;
    }

    const startsAtUtc = startsAt ? fromDatetimeLocalValue(startsAt) : null;
    if (!startsAt || !startsAtUtc) {
      errors.startsAt = "Enter a valid date and time.";
    }

    // Validate the trimmed length, matching what's actually submitted below
    // — otherwise trailing-whitespace-padded input could be rejected here
    // even though the value that would be sent is within the limit.
    if (location.trim().length > LOCATION_MAX) {
      errors.location = `Location must be ${LOCATION_MAX} characters or fewer.`;
    }

    if (notes.trim().length > NOTES_MAX) {
      errors.notes = `Notes must be ${NOTES_MAX} characters or fewer.`;
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0 || !startsAtUtc) {
      return null;
    }
    return { startsAtUtc };
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    // Defense-in-depth alongside the disabled button below: if this
    // somehow still fires while the capture section is parked on its own
    // duplicate/ambiguous review (e.g. a queued click that landed just as
    // the button became disabled), don't re-run the whole submit — that
    // would create a second event in create mode. The user needs to
    // resolve the pending review first.
    if (contactSubmitBlocked) {
      return;
    }

    setFormError(null);

    // EVT-0003 AC1-AC3: block submission client-side, no network call, on
    // any invalid field.
    const validated = validate();
    if (!validated) {
      scrollToFirstInvalidField(formRef.current);
      return;
    }

    // One submit button now covers both the event fields and the optional
    // "capture a contact" section. If the user actually put something
    // there, validate it too, up front — before anything is saved — so we
    // never end up creating/updating the event only to fail on a
    // fixable contact error a moment later.
    const capture = captureRef.current;
    const contactHasInput = capture ? !capture.isEmpty() : false;
    if (contactHasInput && capture && !capture.validate()) {
      scrollToFirstInvalidField(formRef.current);
      return;
    }

    const input: CreateEventInput | UpdateEventInput = {
      name: name.trim(),
      starts_at: validated.startsAtUtc,
      ...(location.trim() ? { location: location.trim() } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    };

    setSubmitting(true);
    try {
      const savedEvent = await onSubmit(input);
      if (!contactHasInput) {
        // EVT-0002 AC5: on success, the parent (page-level) component owns
        // navigation away from the form via onSaved.
        onSaved?.();
        return;
      }
      // Hand the just-saved event's id straight to the capture section —
      // in create mode this is the first moment a real id exists, one
      // render before it could arrive back down as this component's own
      // `initialEvent` prop (event-image-form/design.md Decisions).
      // ManualCaptureForm calls onSaved itself once its own save truly
      // finishes, which may be immediately or only after the user resolves
      // a duplicate/ambiguous review — so navigation isn't triggered here.
      await capture?.submit(savedEvent.id);
    } catch (err) {
      // EVT-0002 AC5: preserve the user's input on failure — no reset.
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form ref={formRef} noValidate onSubmit={handleSubmit} className="max-w-4xl space-y-6">
      <div className="max-w-xl space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="event-name">Name <span className="text-destructive">*</span></Label>
        <Input
          id="event-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={Boolean(fieldErrors.name)}
          aria-describedby={fieldErrors.name ? "event-name-error" : undefined}
          disabled={submitting}
          required
        />
        {fieldErrors.name && (
          <p id="event-name-error" className="text-sm text-destructive">
            {fieldErrors.name}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="event-starts-at">Date and time <span className="text-destructive">*</span></Label>
        <DateTimePicker
          id="event-starts-at"
          value={startsAt}
          onChange={(e) => setStartsAt(e.target.value)}
          onValueChange={setStartsAt}
          aria-invalid={Boolean(fieldErrors.startsAt)}
          aria-describedby={fieldErrors.startsAt ? "event-starts-at-error" : undefined}
          disabled={submitting}
        />
        {fieldErrors.startsAt && (
          <p id="event-starts-at-error" className="text-sm text-destructive">
            {fieldErrors.startsAt}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="event-location">Location <span className="text-muted-foreground">(Optional)</span></Label>
        <Input
          id="event-location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          aria-invalid={Boolean(fieldErrors.location)}
          aria-describedby={fieldErrors.location ? "event-location-error" : undefined}
          disabled={submitting}
        />
        {fieldErrors.location && (
          <p id="event-location-error" className="text-sm text-destructive">
            {fieldErrors.location}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="event-notes">Notes <span className="text-muted-foreground">(Optional)</span></Label>
        <textarea
          id="event-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          aria-invalid={Boolean(fieldErrors.notes)}
          aria-describedby={fieldErrors.notes ? "event-notes-error" : undefined}
          disabled={submitting}
          rows={4}
          className="w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
        />

        {fieldErrors.notes && (
          <p id="event-notes-error" className="text-sm text-destructive">
            {fieldErrors.notes}
          </p>
        )}
      </div>
      </div>

      {/* Now inside the same <form> as the event fields — ManualCaptureForm
          no longer renders its own <form>/submit button (it's driven
          imperatively via captureRef, see handleSubmit), so the "two
          nested forms" concern this used to be split up to avoid no longer
          applies. One form, one submit button, for both the event and the
          optional contact.
          Create mode only — editing an existing event no longer shows this
          section; captureRef simply stays null then, which handleSubmit's
          `capture ? ... : false` guards already handle safely. */}
      {mode === "create" && (
        <div className="space-y-4 rounded-xl border border-border bg-muted/20 p-5">
          <div>
            <h2 className="text-base font-semibold tracking-tight">
              Capture a contact <span className="font-normal text-muted-foreground">(Optional)</span>
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Add a contact for this event now, or skip this and capture contacts later from the
              event&apos;s page.
            </p>
          </div>
          <CaptureSection
            ref={captureRef}
            eventId={initialEvent?.id}
            onSaved={onSaved}
            onAwaitingReviewChange={setAwaitingContactReview}
            onUploadPendingChange={setContactImageUploadPending}
          />
        </div>
      )}

      {formError && (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      )}

      <Button type="submit" disabled={submitting || contactSubmitBlocked}>
        {submitting
          ? "Saving..."
          : contactImageUploadPending
            ? "Wait for the business card image to finish uploading"
            : awaitingContactReview
              ? "Resolve the contact review above first"
              : mode === "create"
                ? "Create Event"
                : "Save Changes"}
      </Button>
    </form>
  );
}