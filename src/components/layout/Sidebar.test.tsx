import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Sidebar } from "./Sidebar";

const usePathnameMock = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => usePathnameMock(),
}));

const signOutMock = vi.fn();
vi.mock("@/hooks/useSignOut", () => ({
  useSignOut: () => ({ signOut: signOutMock, signingOut: false }),
}));

beforeEach(() => {
  usePathnameMock.mockReset().mockReturnValue("/dashboard");
  signOutMock.mockReset();
});

describe("Sidebar", () => {
  it("renders the Homepage link and all four nav items with correct hrefs", () => {
    render(<Sidebar />);

    expect(screen.getByRole("link", { name: "Homepage" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: /Dashboard/ })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("link", { name: /Event List/ })).toHaveAttribute("href", "/events");
    expect(screen.getByRole("link", { name: /Client List/ })).toHaveAttribute("href", "/contacts");
  });

  // Requirement: responsive off-canvas drawer for mobile viewports
  describe("Sidebar mobile drawer", () => {
    it("also renders a mobile-only home link, distinctly labeled from the desktop rail's", () => {
      render(<Sidebar />);

      expect(screen.getByRole("link", { name: "Cotople home" })).toHaveAttribute("href", "/");
    });

    it("opens the drawer via the mobile menu button and closes it via the close button", () => {
      render(<Sidebar />);

      const nav = screen.getByRole("navigation").closest("aside") as HTMLElement;
      expect(nav).toHaveClass("-translate-x-full");

      fireEvent.click(screen.getByRole("button", { name: "Open navigation menu" }));
      expect(nav).toHaveClass("translate-x-0");

      fireEvent.click(screen.getByRole("button", { name: "Close navigation menu" }));
      expect(nav).toHaveClass("-translate-x-full");
    });

    it("closes the drawer via the backdrop", () => {
      render(<Sidebar />);

      fireEvent.click(screen.getByRole("button", { name: "Open navigation menu" }));
      const nav = screen.getByRole("navigation").closest("aside") as HTMLElement;
      expect(nav).toHaveClass("translate-x-0");

      fireEvent.click(screen.getByTestId("sidebar-backdrop"));
      expect(nav).toHaveClass("-translate-x-full");
    });

    it("closes the drawer automatically when the route changes", () => {
      const { rerender } = render(<Sidebar />);
      fireEvent.click(screen.getByRole("button", { name: "Open navigation menu" }));
      const nav = screen.getByRole("navigation").closest("aside") as HTMLElement;
      expect(nav).toHaveClass("translate-x-0");

      usePathnameMock.mockReturnValue("/events");
      rerender(<Sidebar />);

      expect(nav).toHaveClass("-translate-x-full");
    });
  });

  it("marks the current section as active via aria-current", () => {
    usePathnameMock.mockReturnValue("/events");
    render(<Sidebar />);

    expect(screen.getByRole("link", { name: /Event List/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /Dashboard/ })).not.toHaveAttribute("aria-current");
  });

  it("treats nested routes as active for their section", () => {
    usePathnameMock.mockReturnValue("/events/e1/capture");
    render(<Sidebar />);

    expect(screen.getByRole("link", { name: /Event List/ })).toHaveAttribute("aria-current", "page");
  });

  it("calls signOut when Log Out is clicked", () => {
    render(<Sidebar />);

    fireEvent.click(screen.getByRole("button", { name: "Log Out" }));

    expect(signOutMock).toHaveBeenCalledTimes(1);
  });
});
