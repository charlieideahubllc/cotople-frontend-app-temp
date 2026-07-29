import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DuplicateReview } from "./DuplicateReview";
import type { Contact, ContactInput } from "@/lib/api/contacts.types";

const matched: Contact = {
  id: "c1",
  first_name: "Ada",
  last_name: "Lovelace",
  company: "Analytical Engines Ltd",
  position: null,
  phone: "+15551234567",
  email: null,
  website: null,
  address: null,
  created_at: "2026-07-27T00:00:00.000Z",
  updated_at: "2026-07-27T00:00:00.000Z",
};

const incoming: ContactInput = {
  first_name: "Ada",
  last_name: "Lovelace",
  company: "Babbage & Co",
  phone: "+15551234567",
};

// Requirement: CAP-0004 AC1
describe("DuplicateReview", () => {
  it("renders the phone-match message and existing vs. incoming values", () => {
    render(
      <DuplicateReview
        resolution="phone_match"
        matched={matched}
        incoming={incoming}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(
      screen.getByText(
        "A contact with this phone number already exists. Review the existing and incoming values before continuing.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Analytical Engines Ltd")).toBeInTheDocument();
    expect(screen.getByText("Babbage & Co")).toBeInTheDocument();
  });

  it("renders the email-match message, adapted for the matched field", () => {
    render(
      <DuplicateReview
        resolution="email_match"
        matched={matched}
        incoming={incoming}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(
      screen.getByText(
        "A contact with this email address already exists. Review the existing and incoming values before continuing.",
      ),
    ).toBeInTheDocument();
  });

  it("fires onConfirm and onCancel", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <DuplicateReview
        resolution="phone_match"
        matched={matched}
        incoming={incoming}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Confirm and Save" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Back to Form" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
