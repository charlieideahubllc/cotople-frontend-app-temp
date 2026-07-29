import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RequireRole } from "./RequireRole";
import { useSession } from "@/hooks/useSession";
import type { SessionState } from "@/hooks/useSession";

vi.mock("@/hooks/useSession", () => ({
  useSession: vi.fn(),
}));

const useSessionMock = vi.mocked(useSession);

function mockSession(state: Partial<SessionState>) {
  useSessionMock.mockReturnValue({
    user: null,
    role: null,
    loading: false,
    ...state,
  });
}

// Requirements: AUTHZ-0001 AC1-AC4; AUTHZ-0002 AC2; AUTHZ-0003 AC2
describe("RequireRole", () => {
  it("renders fallback (not children) while loading, regardless of eventual role", () => {
    mockSession({ role: "admin", loading: true });

    render(
      <RequireRole allow="admin" fallback={<span>fallback</span>}>
        <span>secret</span>
      </RequireRole>,
    );

    expect(screen.queryByText("secret")).not.toBeInTheDocument();
    expect(screen.getByText("fallback")).toBeInTheDocument();
  });

  it("renders children when role matches a single allowed role", () => {
    mockSession({ role: "admin" });

    render(
      <RequireRole allow="admin">
        <span>secret</span>
      </RequireRole>,
    );

    expect(screen.getByText("secret")).toBeInTheDocument();
  });

  it("renders fallback when role does not match the allowed role", () => {
    mockSession({ role: "staff" });

    render(
      <RequireRole allow="admin" fallback={<span>fallback</span>}>
        <span>secret</span>
      </RequireRole>,
    );

    expect(screen.queryByText("secret")).not.toBeInTheDocument();
    expect(screen.getByText("fallback")).toBeInTheDocument();
  });

  it("renders fallback when role is null", () => {
    mockSession({ role: null });

    render(
      <RequireRole allow="admin" fallback={<span>fallback</span>}>
        <span>secret</span>
      </RequireRole>,
    );

    expect(screen.queryByText("secret")).not.toBeInTheDocument();
    expect(screen.getByText("fallback")).toBeInTheDocument();
  });

  it("renders children when role matches one of an array of allowed roles", () => {
    mockSession({ role: "staff" });

    render(
      <RequireRole allow={["admin", "staff"]}>
        <span>secret</span>
      </RequireRole>,
    );

    expect(screen.getByText("secret")).toBeInTheDocument();
  });

  it("renders nothing (default fallback) when hidden and no fallback prop is given", () => {
    mockSession({ role: "staff" });

    const { container } = render(
      <RequireRole allow="admin">
        <span>secret</span>
      </RequireRole>,
    );

    expect(screen.queryByText("secret")).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });
});
