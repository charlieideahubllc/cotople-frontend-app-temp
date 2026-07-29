import { forwardRef, useImperativeHandle } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CaptureMethodPage from "./page";
import type { CaptureSectionHandle, CaptureSectionProps } from "@/app/(protected)/capture/CaptureSection";

const backMock = vi.fn();
const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "e1" }),
  useRouter: () => ({ back: backMock, push: pushMock }),
}));

const captureHandle: CaptureSectionHandle = {
  isEmpty: vi.fn(() => false),
  validate: vi.fn(() => true),
  submit: vi.fn().mockResolvedValue(undefined),
};

// A minimal stand-in for the real CaptureSection (its own extraction
// wiring is covered by CaptureSection.test.tsx) — this file only verifies
// that the page wires CaptureSection's imperative handle to its "Save
// Contact" button and its onSaved callback to navigation.
vi.mock("@/app/(protected)/capture/CaptureSection", () => ({
  CaptureSection: forwardRef<CaptureSectionHandle, CaptureSectionProps>(function CaptureSection(
    { eventId, onSaved, onAwaitingReviewChange, onUploadPendingChange },
    ref,
  ) {
    useImperativeHandle(ref, () => captureHandle);
    return (
      <div data-testid="capture-section" data-event-id={eventId}>
        <button type="button" onClick={onSaved}>
          Simulate save success
        </button>
        <button type="button" onClick={() => onAwaitingReviewChange?.(true)}>
          Simulate awaiting review
        </button>
        <button type="button" onClick={() => onUploadPendingChange?.(true)}>
          Simulate upload in progress
        </button>
      </div>
    );
  }),
}));

beforeEach(() => {
  backMock.mockReset();
  pushMock.mockReset();
  vi.mocked(captureHandle.submit).mockReset().mockResolvedValue(undefined);
});

// Requirement: CAP-0003 AC3
describe("CaptureMethodPage", () => {
  it("renders the capture section for the selected event, for any authenticated role (no role gate, SRS §6.2)", () => {
    render(<CaptureMethodPage />);

    expect(screen.getByTestId("capture-section")).toHaveAttribute("data-event-id", "e1");
  });

  it("navigates back to the previous page rather than a fixed route", () => {
    render(<CaptureMethodPage />);

    fireEvent.click(screen.getByRole("button", { name: /Back to Events/ }));

    expect(backMock).toHaveBeenCalledTimes(1);
  });

  it("calls the capture section's submit with the real event id when Save Contact is clicked", async () => {
    render(<CaptureMethodPage />);

    fireEvent.click(screen.getByRole("button", { name: "Save Contact" }));

    await waitFor(() => expect(captureHandle.submit).toHaveBeenCalledWith("e1"));
  });

  it("navigates to the event detail page once the capture section reports a real save", () => {
    render(<CaptureMethodPage />);

    fireEvent.click(screen.getByRole("button", { name: "Simulate save success" }));

    expect(pushMock).toHaveBeenCalledWith("/events/e1");
  });

  // Regression test for the same accidental-resubmit bug fixed in
  // EventForm: submit()'s promise resolves as soon as the capture section
  // parks on its own duplicate/ambiguous review, before the user acts on
  // it — the page's own button must stay disabled for that whole window,
  // not just during the network round trip.
  it("disables Save Contact while the capture section reports it's awaiting review, and a forced click doesn't call submit again", async () => {
    render(<CaptureMethodPage />);

    fireEvent.click(screen.getByRole("button", { name: "Simulate awaiting review" }));

    const saveButton = screen.getByRole("button", { name: /Save Contact|Resolve the review/ });
    expect(saveButton).toBeDisabled();
    expect(saveButton).toHaveTextContent("Resolve the review above first");

    fireEvent.click(saveButton);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(captureHandle.submit).not.toHaveBeenCalled();
  });

  // Regression test: isEmpty() only looks at manual field values and a
  // *finished* upload's imageId — while the business-card image is still
  // uploading, isEmpty() would wrongly report the section as unused. Without
  // this guard, a click mid-upload would call submit() and navigate away,
  // silently abandoning the in-flight image.
  it("disables Save Contact while the capture section reports an upload in progress, and a forced click doesn't call submit", async () => {
    render(<CaptureMethodPage />);

    fireEvent.click(screen.getByRole("button", { name: "Simulate upload in progress" }));

    const saveButton = screen.getByRole("button", { name: /Save Contact|Wait for the business card/ });
    expect(saveButton).toBeDisabled();
    expect(saveButton).toHaveTextContent("Wait for the business card image to finish uploading");

    fireEvent.click(saveButton);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(captureHandle.submit).not.toHaveBeenCalled();
  });
});
