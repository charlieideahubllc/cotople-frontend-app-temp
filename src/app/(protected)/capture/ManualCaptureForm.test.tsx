import { createRef } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ManualCaptureForm, type ManualCaptureFormHandle } from "./ManualCaptureForm";
import type { ImageCaptureState } from "./CaptureSection";
import { resolveContact, createEventContact } from "@/lib/api/contacts";
import { confirmImage, extractImage, requestUploadUrl, uploadImageToStorage } from "@/lib/api/images";
import { SessionExpiredError } from "@/lib/api/axiosClient";
import { SESSION_EXPIRED_MESSAGE } from "@/lib/api/session-expired";
import type { Contact, Occurrence, ResolveResult, CreateEventContactResult } from "@/lib/api/contacts.types";

vi.mock("@/lib/api/contacts", () => ({
  resolveContact: vi.fn(),
  createEventContact: vi.fn(),
}));

// ManualCaptureForm imports ImagesApiError directly (to distinguish
// AMBIGUOUS_DUPLICATE from confirmImage) and, via images.hooks.ts's
// useConfirmImageMutation, transitively touches every export of "./images"
// — all four need a mock here even though only confirmImage is exercised
// by this file's own assertions (same pattern as CaptureSection.test.tsx).
vi.mock("@/lib/api/images", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/images")>();
  return {
    ImagesApiError: actual.ImagesApiError,
    requestUploadUrl: vi.fn(),
    uploadImageToStorage: vi.fn(),
    extractImage: vi.fn(),
    confirmImage: vi.fn(),
  };
});

const resolveContactMock = vi.mocked(resolveContact);
const createEventContactMock = vi.mocked(createEventContact);
const confirmImageMock = vi.mocked(confirmImage);
// Referenced only to keep the mock factory's shape honest with the real
// module — not directly asserted on in this file's tests.
void extractImage;
void requestUploadUrl;
void uploadImageToStorage;

// ManualCaptureForm no longer owns a visible submit button — the single
// EventForm submit button drives it via this imperative ref instead. Kept
// module-level (reassigned by every renderForm() call) so the existing
// `submit()` helper below can stay a simple zero-arg function, matching
// every pre-existing call site's shape.
let formRef: React.RefObject<ManualCaptureFormHandle | null>;

function renderForm({
  eventId,
  imageCapture,
  onAwaitingReviewChange,
}: {
  eventId?: string;
  imageCapture?: ImageCaptureState | null;
  onAwaitingReviewChange?: (awaitingReview: boolean) => void;
} = { eventId: "e1" }) {
  formRef = createRef<ManualCaptureFormHandle>();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ManualCaptureForm
        ref={formRef}
        eventId={eventId}
        imageCapture={imageCapture}
        onAwaitingReviewChange={onAwaitingReviewChange}
      />
    </QueryClientProvider>,
  );
}

function completedImageCapture(overrides: Partial<ImageCaptureState> = {}): ImageCaptureState {
  return {
    imageId: "img-1",
    status: "completed",
    fields: {},
    warnings: [],
    captureMethod: "image",
    ...overrides,
  };
}

const sampleContact: Contact = {
  id: "c1",
  first_name: "Ada",
  last_name: "Lovelace",
  company: null,
  position: null,
  phone: "+15551234567",
  email: null,
  website: null,
  address: null,
  created_at: "2026-07-27T00:00:00.000Z",
  updated_at: "2026-07-27T00:00:00.000Z",
};

function sampleOccurrence(overrides: Partial<Occurrence> = {}): Occurrence {
  return {
    id: "occ-1",
    event_id: "e1",
    contact_id: "c1",
    captured_by_profile_id: "p1",
    captured_at: "2026-07-27T00:00:00.000Z",
    capture_method: "manual",
    notes: null,
    contact_image_id: null,
    duplicate_resolution: "new",
    ghl_sync_status: "pending",
    ...overrides,
  };
}

function noMatchResult(): ResolveResult {
  return { match: "no_match", contact: null, reason: null };
}

function captureResult(overrides: Partial<CreateEventContactResult> = {}): CreateEventContactResult {
  return {
    contact: sampleContact,
    occurrence: sampleOccurrence(),
    duplicate_resolution: "new",
    pending_review_fields: [],
    ...overrides,
  };
}

function fillRequiredFields({ phone = "5551234567", email = "" }: { phone?: string; email?: string } = {}) {
  fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Ada" } });
  fireEvent.change(screen.getByLabelText("Last name"), { target: { value: "Lovelace" } });
  if (phone) {
    fireEvent.change(screen.getByLabelText("Phone"), { target: { value: phone } });
  }
  if (email) {
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  }
}

function submit() {
  // formRef.current.submit() isn't dispatched through fireEvent, so its
  // synchronous state updates (e.g. setFieldErrors on a validation
  // failure) need an explicit act() to flush before assertions run —
  // fireEvent normally does this implicitly for a real button click.
  act(() => {
    void formRef.current?.submit();
  });
}

beforeEach(() => {
  resolveContactMock.mockReset();
  createEventContactMock.mockReset();
  confirmImageMock.mockReset();
});

// Requirement: CAP-0002 AC1-AC6
describe("ManualCaptureForm field validation", () => {
  it("blocks submit with no API call when first name is empty", () => {
    renderForm();
    fireEvent.change(screen.getByLabelText("Last name"), { target: { value: "Lovelace" } });
    fireEvent.change(screen.getByLabelText("Phone"), { target: { value: "5551234567" } });
    submit();

    expect(screen.getByText(/Enter a first name/)).toBeInTheDocument();
    expect(resolveContactMock).not.toHaveBeenCalled();
  });

  it("blocks submit with no API call when both phone and email are empty, showing the exact SRS message", () => {
    renderForm();
    fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Ada" } });
    fireEvent.change(screen.getByLabelText("Last name"), { target: { value: "Lovelace" } });
    submit();

    expect(screen.getByText("Enter a valid phone number or email address.")).toBeInTheDocument();
    expect(resolveContactMock).not.toHaveBeenCalled();
  });

  it("blocks submit with no API call on an invalid email", () => {
    renderForm();
    fillRequiredFields({ phone: "", email: "not-an-email" });
    submit();

    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
    expect(resolveContactMock).not.toHaveBeenCalled();
  });

  it("blocks submit with no API call on an invalid website URL", () => {
    renderForm();
    fillRequiredFields();
    fireEvent.change(screen.getByLabelText("Website"), { target: { value: "not-a-url" } });
    submit();

    expect(screen.getByText(/Enter a valid http/)).toBeInTheDocument();
    expect(resolveContactMock).not.toHaveBeenCalled();
  });

  it("normalizes a valid email's domain to lowercase before submitting", async () => {
    resolveContactMock.mockResolvedValue(noMatchResult());
    createEventContactMock.mockResolvedValue(captureResult());

    renderForm();
    fillRequiredFields({ phone: "", email: "Ada@EXAMPLE.com" });
    submit();

    // resolveContact only takes {phone, email} — not event-scoped, and not
    // the full ContactInput (Task 7 real-backend verification).
    await waitFor(() =>
      expect(resolveContactMock).toHaveBeenCalledWith(
        expect.objectContaining({ email: "Ada@example.com" }),
      ),
    );
  });
});

// Requirement: CAP-0001 AC2, AC3; CAP-0004 AC1-AC4
describe("ManualCaptureForm resolve/save flow", () => {
  it("saves directly (no duplicate step) when resolveContact returns 'no_match'", async () => {
    resolveContactMock.mockResolvedValue(noMatchResult());
    createEventContactMock.mockResolvedValue(captureResult());

    renderForm();
    fillRequiredFields();
    submit();

    await waitFor(() => expect(createEventContactMock).toHaveBeenCalledTimes(1));
    expect(
      await screen.findByText("The contact is saved. HighLevel synchronization is still pending."),
    ).toBeInTheDocument();
  });

  it("renders DuplicateReview on a phone_match and only calls createEventContact after confirm", async () => {
    resolveContactMock.mockResolvedValue({ match: "phone_match", contact: sampleContact, reason: null });
    createEventContactMock.mockResolvedValue(
      captureResult({ occurrence: sampleOccurrence({ ghl_sync_status: "synced" }) }),
    );

    renderForm();
    fillRequiredFields();
    submit();

    expect(await screen.findByTestId("duplicate-review")).toBeInTheDocument();
    expect(createEventContactMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Confirm and Save" }));

    await waitFor(() => expect(createEventContactMock).toHaveBeenCalledTimes(1));
  });

  it("blocks save and never calls createEventContact when the match is ambiguous", async () => {
    resolveContactMock.mockResolvedValue({
      match: "ambiguous",
      contact: null,
      reason: "phone and email identify different contacts",
    });

    renderForm();
    fillRequiredFields();
    submit();

    expect(await screen.findByTestId("ambiguous-review")).toBeInTheDocument();
    expect(createEventContactMock).not.toHaveBeenCalled();
  });
});

// Requirement: fix for accidental duplicate event/contact creation on
// re-click while duplicate/ambiguous review is showing (a caller with its
// own primary submit button, e.g. EventForm, uses this to disable it).
describe("ManualCaptureForm onAwaitingReviewChange", () => {
  it("reports true when a phone/email match parks on the duplicate-review step, then false once confirmed", async () => {
    resolveContactMock.mockResolvedValue({ match: "phone_match", contact: sampleContact, reason: null });
    createEventContactMock.mockResolvedValue(captureResult());
    const onAwaitingReviewChange = vi.fn();

    renderForm({ eventId: "e1", onAwaitingReviewChange });
    fillRequiredFields();
    submit();

    await screen.findByTestId("duplicate-review");
    expect(onAwaitingReviewChange).toHaveBeenLastCalledWith(true);

    fireEvent.click(screen.getByRole("button", { name: "Confirm and Save" }));

    await waitFor(() => expect(createEventContactMock).toHaveBeenCalledTimes(1));
    expect(onAwaitingReviewChange).toHaveBeenLastCalledWith(false);
  });

  it("reports true when the match is ambiguous, then false once the user goes back to the form", async () => {
    resolveContactMock.mockResolvedValue({
      match: "ambiguous",
      contact: null,
      reason: "phone and email identify different contacts",
    });
    const onAwaitingReviewChange = vi.fn();

    renderForm({ eventId: "e1", onAwaitingReviewChange });
    fillRequiredFields();
    submit();

    await screen.findByTestId("ambiguous-review");
    expect(onAwaitingReviewChange).toHaveBeenLastCalledWith(true);

    fireEvent.click(screen.getByRole("button", { name: "Back to Form" }));
    expect(onAwaitingReviewChange).toHaveBeenLastCalledWith(false);
  });

  it("never reports true for the ordinary no_match save path", async () => {
    resolveContactMock.mockResolvedValue(noMatchResult());
    createEventContactMock.mockResolvedValue(captureResult());
    const onAwaitingReviewChange = vi.fn();

    renderForm({ eventId: "e1", onAwaitingReviewChange });
    fillRequiredFields();
    submit();

    await waitFor(() => expect(createEventContactMock).toHaveBeenCalledTimes(1));
    expect(onAwaitingReviewChange).not.toHaveBeenCalledWith(true);
  });
});

// Requirement: CAP-0005 AC1, AC2, AC3
describe("ManualCaptureForm idempotency key lifecycle", () => {
  it("reuses the same idempotency key across a retry of the same attempt", async () => {
    resolveContactMock.mockResolvedValue(noMatchResult());
    createEventContactMock.mockRejectedValueOnce(new Error("network error"));
    createEventContactMock.mockResolvedValueOnce(captureResult());

    renderForm();
    fillRequiredFields();
    submit();

    await waitFor(() => expect(createEventContactMock).toHaveBeenCalledTimes(1));
    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));

    await waitFor(() => expect(createEventContactMock).toHaveBeenCalledTimes(2));
    const firstKey = createEventContactMock.mock.calls[0][2];
    const secondKey = createEventContactMock.mock.calls[1][2];
    expect(secondKey).toBe(firstKey);
  });

  it("generates a new idempotency key when the user edits a field after a failed attempt", async () => {
    resolveContactMock.mockResolvedValue(noMatchResult());
    createEventContactMock.mockRejectedValueOnce(new Error("network error"));
    createEventContactMock.mockResolvedValueOnce(captureResult());

    renderForm();
    fillRequiredFields();
    submit();

    await waitFor(() => expect(createEventContactMock).toHaveBeenCalledTimes(1));
    const firstKey = createEventContactMock.mock.calls[0][2];

    // Editing a field invalidates the attempt — CAP-0005 AC3.
    fireEvent.change(screen.getByLabelText("Company"), { target: { value: "Acme" } });
    submit();

    await waitFor(() => expect(createEventContactMock).toHaveBeenCalledTimes(2));
    const secondKey = createEventContactMock.mock.calls[1][2];
    expect(secondKey).not.toBe(firstKey);
  });
});

// Requirement: CAP-0001 AC4; CAP-0003 AC2
describe("ManualCaptureForm error handling", () => {
  it("preserves entered field values when createEventContact fails", async () => {
    resolveContactMock.mockResolvedValue(noMatchResult());
    createEventContactMock.mockRejectedValue(new Error("Server exploded"));

    renderForm();
    fillRequiredFields();
    submit();

    expect(await screen.findByText("Server exploded")).toBeInTheDocument();
    expect(screen.getByLabelText("First name")).toHaveValue("Ada");
    expect(screen.getByLabelText("Last name")).toHaveValue("Lovelace");
  });

  it("shows the exact SRS §6.3 session-expired message when the API throws SessionExpiredError", async () => {
    resolveContactMock.mockRejectedValue(new SessionExpiredError());

    renderForm();
    fillRequiredFields();
    submit();

    expect(await screen.findByText(SESSION_EXPIRED_MESSAGE)).toBeInTheDocument();
  });
});

describe("ManualCaptureForm without an eventId", () => {
  it("blocks saving with a clear message instead of calling createEventContact", async () => {
    resolveContactMock.mockResolvedValue(noMatchResult());

    renderForm({});
    fillRequiredFields();
    submit();

    expect(
      await screen.findByText("Select or create an event before saving this contact."),
    ).toBeInTheDocument();
    expect(createEventContactMock).not.toHaveBeenCalled();
  });

  it("still resolves duplicates without an eventId (resolve is not event-scoped)", async () => {
    resolveContactMock.mockResolvedValue(noMatchResult());

    renderForm({});
    fillRequiredFields();
    submit();

    await waitFor(() => expect(resolveContactMock).toHaveBeenCalledTimes(1));
  });
});

// Requirement: EIF-0002 AC1, AC2, AC3, AC4, AC5
describe("ManualCaptureForm autofill from imageCapture", () => {
  it("populates fields present in a completed extraction", () => {
    renderForm({
      eventId: "e1",
      imageCapture: completedImageCapture({
        fields: {
          first_name: { value: "Ada", source: "ai" },
          email: { value: "ada@example.com", source: "qr" },
        },
      }),
    });

    expect(screen.getByLabelText("First name")).toHaveValue("Ada");
    expect(screen.getByLabelText("Email")).toHaveValue("ada@example.com");
  });

  it("leaves a field absent from the extraction response untouched", () => {
    renderForm({
      eventId: "e1",
      imageCapture: completedImageCapture({
        fields: { first_name: { value: "Ada", source: "ai" } },
      }),
    });

    expect(screen.getByLabelText("Company")).toHaveValue("");
  });

  it("keeps an autofilled field a normal editable input, per CLAUDE.md's no-locked-fields rule", () => {
    renderForm({
      eventId: "e1",
      imageCapture: completedImageCapture({
        fields: { first_name: { value: "Ada", source: "ai" } },
      }),
    });

    const firstNameInput = screen.getByLabelText("First name");
    expect(firstNameInput).not.toBeDisabled();
    fireEvent.change(firstNameInput, { target: { value: "Grace" } });
    expect(firstNameInput).toHaveValue("Grace");
  });

  it("does not overwrite a field the user has already edited when a later extraction completes", () => {
    const { rerender } = renderForm({ eventId: "e1", imageCapture: null });

    fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Grace" } });

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    rerender(
      <QueryClientProvider client={queryClient}>
        <ManualCaptureForm
          eventId="e1"
          imageCapture={completedImageCapture({
            fields: { first_name: { value: "Ada", source: "ai" } },
          })}
        />
      </QueryClientProvider>,
    );

    expect(screen.getByLabelText("First name")).toHaveValue("Grace");
  });

  it("clears a previously-autofilled, untouched field when the image is replaced and the new extraction omits it", () => {
    const { rerender } = renderForm({
      eventId: "e1",
      imageCapture: completedImageCapture({
        imageId: "img-1",
        fields: { first_name: { value: "Ada", source: "ai" } },
      }),
    });
    expect(screen.getByLabelText("First name")).toHaveValue("Ada");

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    rerender(
      <QueryClientProvider client={queryClient}>
        <ManualCaptureForm
          eventId="e1"
          imageCapture={completedImageCapture({ imageId: "img-2", fields: {} })}
        />
      </QueryClientProvider>,
    );

    expect(screen.getByLabelText("First name")).toHaveValue("");
  });
});

// Requirement: EIF-0003 AC1, AC2, AC3, AC4, AC5
describe("ManualCaptureForm submission via image confirm", () => {
  it("calls confirmImage (not createEventContact) with the correct event_id/capture_method when an image is present", async () => {
    confirmImageMock.mockResolvedValue(captureResult());

    renderForm({ eventId: "e1", imageCapture: completedImageCapture({ imageId: "img-1" }) });
    fillRequiredFields();
    submit();

    await waitFor(() => expect(confirmImageMock).toHaveBeenCalledTimes(1));
    expect(createEventContactMock).not.toHaveBeenCalled();
    expect(resolveContactMock).not.toHaveBeenCalled();

    const [imageId, input] = confirmImageMock.mock.calls[0];
    expect(imageId).toBe("img-1");
    expect(input).toMatchObject({ event_id: "e1", capture_method: "image" });
  });

  it("shows the success state with the returned sync status on a successful confirm", async () => {
    confirmImageMock.mockResolvedValue(
      captureResult({ occurrence: sampleOccurrence({ ghl_sync_status: "synced" }) }),
    );

    renderForm({ eventId: "e1", imageCapture: completedImageCapture() });
    fillRequiredFields();
    submit();

    expect(await screen.findByText(/synchronized with HighLevel/i)).toBeInTheDocument();
  });

  it("routes a 409 AMBIGUOUS_DUPLICATE from confirmImage to the ambiguous-review state", async () => {
    const { ImagesApiError } = await import("@/lib/api/images");
    confirmImageMock.mockRejectedValue(
      new ImagesApiError("AMBIGUOUS_DUPLICATE", "Matches conflict"),
    );

    renderForm({ eventId: "e1", imageCapture: completedImageCapture() });
    fillRequiredFields();
    submit();

    expect(await screen.findByTestId("ambiguous-review")).toBeInTheDocument();
  });

  it("falls back to the plain resolve/create path when no image is part of the session", async () => {
    resolveContactMock.mockResolvedValue(noMatchResult());
    createEventContactMock.mockResolvedValue(captureResult());

    renderForm({ eventId: "e1", imageCapture: null });
    fillRequiredFields();
    submit();

    await waitFor(() => expect(createEventContactMock).toHaveBeenCalledTimes(1));
    expect(confirmImageMock).not.toHaveBeenCalled();
  });
});
