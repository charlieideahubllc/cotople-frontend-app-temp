import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EventForm } from "./EventForm";
import { resolveContact, createEventContact } from "@/lib/api/contacts";
import { requestUploadUrl, uploadImageToStorage } from "@/lib/api/images";
import type { UploadUrlResult } from "@/lib/api/images.types";
import type { CreateEventInput, Event, UpdateEventInput } from "@/lib/api/events.types";
import type { CreateEventContactResult } from "@/lib/api/contacts.types";

// The merged single-submit-button tests below exercise the real capture
// section's contact-save path (contactHasInput === true), which reaches
// through CaptureSection → ManualCaptureForm to these real API functions —
// mock them the same way ManualCaptureForm.test.tsx does.
vi.mock("@/lib/api/contacts", () => ({
  resolveContact: vi.fn(),
  createEventContact: vi.fn(),
}));

// Only the business-card-upload-in-progress regression test below actually
// selects a file — mocked the same way CaptureSection.test.tsx/
// ImageDropzoneField.test.tsx do, so that test can control upload timing
// instead of hitting the real network.
vi.mock("@/lib/api/images", () => ({
  requestUploadUrl: vi.fn(),
  uploadImageToStorage: vi.fn(),
  extractImage: vi.fn(),
}));

const resolveContactMock = vi.mocked(resolveContact);
const createEventContactMock = vi.mocked(createEventContact);
const requestUploadUrlMock = vi.mocked(requestUploadUrl);
const uploadImageToStorageMock = vi.mocked(uploadImageToStorage);

// Create mode renders an embedded capture section (ImageCaptureForm /
// ManualCaptureForm), which uses React Query hooks — needs a
// QueryClientProvider even though this file is only testing EventForm's
// own event-fields behavior, not the capture section.
function renderEventForm(props: React.ComponentProps<typeof EventForm>) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <EventForm {...props} />
    </QueryClientProvider>,
  );
}

const sampleEvent: Event = {
  id: "e1",
  name: "Trade Show",
  starts_at: "2026-08-01T10:00:00.000Z",
  location: "Hall A",
  notes: "Bring extra badges",
  status: "active",
  owner_profile_id: "p1",
  created_at: "2026-07-01T00:00:00.000Z",
  updated_at: "2026-07-01T00:00:00.000Z",
};

function fillValidForm() {
  fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "Conference" } });
  fireEvent.change(screen.getByLabelText(/^Date and time/), {
    target: { value: "2026-09-01T09:00" },
  });
}

let onSubmit: ReturnType<
  typeof vi.fn<(input: CreateEventInput | UpdateEventInput) => Promise<Event>>
>;

beforeEach(() => {
  onSubmit = vi.fn().mockResolvedValue(sampleEvent);
  resolveContactMock.mockReset();
  createEventContactMock.mockReset();
  requestUploadUrlMock.mockReset();
  uploadImageToStorageMock.mockReset();
});

// Requirement: EVT-0003 AC1
describe("EventForm name validation", () => {
  it("blocks submission when name is empty", async () => {
    renderEventForm({ mode: "create", onSubmit });
    fireEvent.change(screen.getByLabelText(/^Date and time/), {
      target: { value: "2026-09-01T09:00" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Create Event" }));

    expect(await screen.findByText("Event name is required.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("blocks submission when name exceeds 150 characters", async () => {
    renderEventForm({ mode: "create", onSubmit });
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "a".repeat(151) } });
    fireEvent.change(screen.getByLabelText(/^Date and time/), {
      target: { value: "2026-09-01T09:00" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Create Event" }));

    expect(
      await screen.findByText("Enter a name between 2 and 150 characters."),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

// Requirement: EVT-0003 AC2
describe("EventForm date validation", () => {
  it("blocks submission when date/time is empty", async () => {
    renderEventForm({ mode: "create", onSubmit });
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "Conference" } });
    // The date/time field defaults to "now" — explicitly clear it to
    // exercise the empty-value validation path.
    fireEvent.change(screen.getByLabelText(/^Date and time/), { target: { value: "" } });

    fireEvent.click(screen.getByRole("button", { name: "Create Event" }));

    expect(await screen.findByText("Enter a valid date and time.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

// Requirement: EVT-0003 AC3
describe("EventForm location/notes length validation", () => {
  it("blocks submission when location exceeds 255 characters", async () => {
    renderEventForm({ mode: "create", onSubmit });
    fillValidForm();
    fireEvent.change(screen.getByLabelText(/^Location/), { target: { value: "a".repeat(256) } });

    fireEvent.click(screen.getByRole("button", { name: "Create Event" }));

    expect(
      await screen.findByText("Location must be 255 characters or fewer."),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("blocks submission when notes exceeds 2000 characters", async () => {
    renderEventForm({ mode: "create", onSubmit });
    fillValidForm();
    fireEvent.change(screen.getByLabelText(/^Notes/), { target: { value: "a".repeat(2001) } });

    fireEvent.click(screen.getByRole("button", { name: "Create Event" }));

    expect(await screen.findByText("Notes must be 2000 characters or fewer.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("does not reject location/notes that are only over the limit before trimming", async () => {
    renderEventForm({ mode: "create", onSubmit });
    fillValidForm();
    // 255 real characters plus trailing whitespace that trim() removes.
    fireEvent.change(screen.getByLabelText(/^Location/), {
      target: { value: `${"a".repeat(255)}   ` },
    });

    fireEvent.click(screen.getByRole("button", { name: "Create Event" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(
      screen.queryByText("Location must be 255 characters or fewer."),
    ).not.toBeInTheDocument();
  });
});

// Requirement: EVT-0003 AC4
describe("EventForm submission payload", () => {
  it("submits with a UTC ISO 8601 starts_at", async () => {
    renderEventForm({ mode: "create", onSubmit });
    fillValidForm();

    fireEvent.click(screen.getByRole("button", { name: "Create Event" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const submitted = onSubmit.mock.calls[0][0];
    expect(submitted.name).toBe("Conference");
    expect(submitted.starts_at).toBe(new Date("2026-09-01T09:00").toISOString());
  });

  it("omits location/notes when left blank", async () => {
    renderEventForm({ mode: "create", onSubmit });
    fillValidForm();

    fireEvent.click(screen.getByRole("button", { name: "Create Event" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const submitted = onSubmit.mock.calls[0][0];
    expect(submitted).not.toHaveProperty("location");
    expect(submitted).not.toHaveProperty("notes");
  });
});

// Requirement: EVT-0002 AC5
describe("EventForm submit failure", () => {
  it("preserves entered values and shows the error when onSubmit rejects", async () => {
    onSubmit.mockRejectedValue(new Error("Name already in use"));
    renderEventForm({ mode: "create", onSubmit });
    fillValidForm();

    fireEvent.click(screen.getByRole("button", { name: "Create Event" }));

    expect(await screen.findByText("Name already in use")).toBeInTheDocument();
    expect(screen.getByLabelText(/^Name/)).toHaveValue("Conference");
    expect(screen.getByLabelText(/^Date and time/)).toHaveValue("2026-09-01T09:00");
  });
});

// Requirement: EVT-0002 AC2
describe("EventForm edit mode", () => {
  it("pre-fills fields from initialEvent", () => {
    renderEventForm({ mode: "edit", initialEvent: sampleEvent, onSubmit });

    expect(screen.getByLabelText(/^Name/)).toHaveValue("Trade Show");
    expect(screen.getByLabelText(/^Location/)).toHaveValue("Hall A");
    expect(screen.getByLabelText(/^Notes/)).toHaveValue("Bring extra badges");
    expect(screen.getByRole("button", { name: "Save Changes" })).toBeInTheDocument();
  });
});

// Requirement: EIF-0004 AC1, AC3
describe("EventForm capture section", () => {
  it("renders the capture section in create mode", () => {
    renderEventForm({ mode: "create", onSubmit });

    expect(screen.getByRole("heading", { name: /Capture a contact/ })).toBeInTheDocument();
    expect(screen.getByTestId("capture-image-business-card-input")).toBeInTheDocument();
    expect(screen.getByLabelText("First name")).toBeInTheDocument();
  });

  it("hides the capture section in edit mode", () => {
    renderEventForm({ mode: "edit", initialEvent: sampleEvent, onSubmit });

    expect(screen.queryByRole("heading", { name: /Capture a contact/ })).not.toBeInTheDocument();
    expect(screen.queryByTestId("capture-image-business-card-input")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("First name")).not.toBeInTheDocument();
  });

  it("still submits the event-fields form successfully with no capture section present", async () => {
    renderEventForm({ mode: "edit", initialEvent: sampleEvent, onSubmit });

    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  });
});

// Requirement: auto-scroll/focus to the first invalid field on a blocked submit
describe("EventForm auto-scroll to first invalid field", () => {
  // jsdom doesn't implement scrollIntoView at all — stub it so the
  // component's typeof-guarded call actually runs during these tests.
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("scrolls to and focuses the event's own first invalid field", async () => {
    renderEventForm({ mode: "create", onSubmit });
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "Conference" } });
    fireEvent.change(screen.getByLabelText(/^Date and time/), { target: { value: "" } });

    fireEvent.click(screen.getByRole("button", { name: "Create Event" }));

    const dateField = screen.getByLabelText(/^Date and time/);
    await waitFor(() => expect(dateField).toHaveFocus());
    expect(dateField.scrollIntoView).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: "smooth" }),
    );
  });

  it("scrolls to and focuses the first invalid contact field when only the contact section is invalid", async () => {
    renderEventForm({ mode: "create", onSubmit });
    fillValidForm();
    // Company only: no first/last name — fails the contact's own required-field rule.
    fireEvent.change(screen.getByLabelText("Company"), { target: { value: "Acme" } });

    fireEvent.click(screen.getByRole("button", { name: "Create Event" }));

    const firstNameField = screen.getByLabelText("First name");
    await waitFor(() => expect(firstNameField).toHaveFocus());
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

// Requirement: single-submit-button merge (event + contact save)
describe("EventForm single submit button — event + contact", () => {
  function fillValidContact() {
    fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Ada" } });
    fireEvent.change(screen.getByLabelText("Last name"), { target: { value: "Lovelace" } });
    fireEvent.change(screen.getByLabelText("Phone"), { target: { value: "5551234567" } });
  }

  it("only saves the event, calling onSaved immediately, when the contact section is left blank", async () => {
    const onSaved = vi.fn();
    renderEventForm({ mode: "create", onSubmit, onSaved });
    fillValidForm();

    fireEvent.click(screen.getByRole("button", { name: "Create Event" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(resolveContactMock).not.toHaveBeenCalled();
    expect(createEventContactMock).not.toHaveBeenCalled();
  });

  it("blocks the entire submit — event included — when the contact section has invalid input", async () => {
    renderEventForm({ mode: "create", onSubmit });
    fillValidForm();
    // First name only: fails the contact's own phone-or-email-required rule.
    fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Ada" } });

    fireEvent.click(screen.getByRole("button", { name: "Create Event" }));

    expect(
      await screen.findByText("Enter a valid phone number or email address."),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("creates the event, then saves the contact using the newly-created event's id", async () => {
    resolveContactMock.mockResolvedValue({ match: "no_match", contact: null, reason: null });
    const captureResult: CreateEventContactResult = {
      contact: {
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
      },
      occurrence: {
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
      },
      duplicate_resolution: "new",
      pending_review_fields: [],
    };
    createEventContactMock.mockResolvedValue(captureResult);
    const onSaved = vi.fn();

    renderEventForm({ mode: "create", onSubmit, onSaved });
    fillValidForm();
    fillValidContact();

    fireEvent.click(screen.getByRole("button", { name: "Create Event" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    // sampleEvent.id ("e1") is what onSubmit resolves to — createEventContact
    // must be called with that real id, not an empty string, even though
    // EventForm's own `initialEvent` prop is undefined the whole time in
    // create mode.
    await waitFor(() => expect(createEventContactMock).toHaveBeenCalledTimes(1));
    expect(createEventContactMock.mock.calls[0][0]).toBe("e1");
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  });

  it("does not attempt to save the contact when the event save itself fails", async () => {
    onSubmit.mockRejectedValue(new Error("Name already in use"));
    renderEventForm({ mode: "create", onSubmit });
    fillValidForm();
    fillValidContact();

    fireEvent.click(screen.getByRole("button", { name: "Create Event" }));

    expect(await screen.findByText("Name already in use")).toBeInTheDocument();
    expect(resolveContactMock).not.toHaveBeenCalled();
    expect(createEventContactMock).not.toHaveBeenCalled();
  });

  // Regression test for the accidental-duplicate-event bug: previously,
  // once the contact's resolve() parked on a phone/email match,
  // capture.submit()'s promise had already settled and `submitting` reset
  // to false — leaving the primary button enabled while DuplicateReview
  // was showing underneath. A second click re-ran the whole handler,
  // including a second real `onSubmit` (event create) call.
  it("disables the submit button while the contact section is showing its own duplicate-review step, preventing a second event from being created on re-click", async () => {
    // Real ResolveResult always pairs a match with a contact — supply one
    // so DuplicateReview actually renders instead of the component's
    // contract-guard error path.
    resolveContactMock.mockResolvedValue({
      match: "phone_match",
      contact: {
        id: "c1",
        first_name: "Grace",
        last_name: "Hopper",
        company: null,
        position: null,
        phone: "+15551234567",
        email: null,
        website: null,
        address: null,
        created_at: "2026-07-27T00:00:00.000Z",
        updated_at: "2026-07-27T00:00:00.000Z",
      },
      reason: null,
    });

    renderEventForm({ mode: "create", onSubmit });
    fillValidForm();
    fillValidContact();

    const submitButton = screen.getByRole("button", { name: "Create Event" });
    fireEvent.click(submitButton);

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    await screen.findByTestId("duplicate-review");

    // The button must be disabled (and re-labeled) while that review is
    // showing — not just momentarily during the network round trip.
    expect(submitButton).toBeDisabled();
    expect(submitButton).toHaveTextContent("Resolve the contact review above first");

    // Even a forced click while disabled must not create a second event —
    // fireEvent bypasses the browser's own disabled-button click
    // suppression, so this specifically exercises handleSubmit's own
    // early-return guard, not just the disabled attribute.
    fireEvent.click(submitButton);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  // Regression test: isEmpty() only looks at manual field values and a
  // *finished* upload's imageId — while the business-card image is still
  // uploading, the manual fields are still blank (waiting on autofill), so
  // isEmpty() would wrongly report the contact section as unused. Without
  // this guard, clicking submit mid-upload would create the event and skip
  // the contact entirely, abandoning the in-flight image.
  it("disables the submit button while the business-card image is still uploading, even though the contact fields are otherwise blank", async () => {
    const sampleUploadTarget: UploadUrlResult = {
      image_id: "img-1",
      upload_url: "https://storage.example.com/signed-put-url?token=secret",
      object_path: "events/e1/cards/img-1.jpg",
      signed_token: "secret",
    };
    requestUploadUrlMock.mockResolvedValue(sampleUploadTarget);
    uploadImageToStorageMock.mockImplementation(() => new Promise<void>(() => {})); // never resolves

    renderEventForm({ mode: "create", onSubmit });
    fillValidForm();

    const submitButton = screen.getByRole("button", { name: "Create Event" });
    fireEvent.change(screen.getByTestId("capture-image-business-card-input"), {
      target: {
        files: [new File([new Uint8Array(1024)], "card.jpg", { type: "image/jpeg" })],
      },
    });

    await waitFor(() =>
      expect(submitButton).toHaveTextContent("Wait for the business card image to finish uploading"),
    );
    expect(submitButton).toBeDisabled();

    fireEvent.click(submitButton);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

// EVT-0003 AC2: shadcn calendar popover as an additional way to set the
// date portion, alongside the still-typeable datetime-local input.
describe("EventForm calendar date picker", () => {
  it("opens a calendar and sets the date portion while preserving the time already entered", async () => {
    renderEventForm({ mode: "create", onSubmit });
    fireEvent.change(screen.getByLabelText(/^Date and time/), {
      target: { value: "2026-09-05T14:30" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Pick a date from the calendar" }));

    const grid = await screen.findByRole("grid");
    fireEvent.click(within(grid).getByRole("button", { name: /September 12(th)?, 2026/ }));

    expect(screen.getByLabelText(/^Date and time/)).toHaveValue("2026-09-12T14:30");
  });
});
