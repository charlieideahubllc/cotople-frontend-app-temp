import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CaptureSuccess } from "./CaptureSuccess";

// Requirement: CAP-0001 AC5
describe("CaptureSuccess", () => {
  it("shows the exact pending sync message", () => {
    render(<CaptureSuccess syncStatus="pending" />);
    expect(
      screen.getByText("The contact is saved. HighLevel synchronization is still pending."),
    ).toBeInTheDocument();
  });

  it("shows the exact failed sync message", () => {
    render(<CaptureSuccess syncStatus="failed" />);
    expect(
      screen.getByText(
        "The contact is saved, but HighLevel synchronization failed. An administrator can retry.",
      ),
    ).toBeInTheDocument();
  });

  it("shows a synced confirmation message", () => {
    render(<CaptureSuccess syncStatus="synced" />);
    expect(
      screen.getByText("The contact is saved and synchronized with HighLevel."),
    ).toBeInTheDocument();
  });
});
