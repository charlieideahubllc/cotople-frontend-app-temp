import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AuthStatusAction } from "./AuthStatusAction";

const pushMock = vi.fn();
const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

const getUserMock = vi.fn();
const signOutMock = vi.fn();
const onAuthStateChangeMock = vi.fn(() => ({
  data: { subscription: { unsubscribe: vi.fn() } },
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: getUserMock,
      onAuthStateChange: onAuthStateChangeMock,
      signOut: signOutMock,
    },
  }),
}));

vi.mock("@/lib/api/client", () => ({
  apiFetch: vi.fn().mockResolvedValue(new Response(null, { status: 500 })),
  SessionExpiredError: class SessionExpiredError extends Error {},
}));

beforeEach(() => {
  pushMock.mockReset();
  refreshMock.mockReset();
  getUserMock.mockReset();
  signOutMock.mockReset();
});

describe("AuthStatusAction signed out", () => {
  it("renders a Log In link to /login", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    render(<AuthStatusAction />);

    const link = await screen.findByRole("button", { name: "Log In" });
    expect(link).toHaveAttribute("href", "/login");
  });
});

describe("AuthStatusAction signed in", () => {
  it("renders a Log Out button that signs out and redirects to /login", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    signOutMock.mockResolvedValue({ error: null });
    render(<AuthStatusAction />);

    const button = await screen.findByRole("button", { name: "Log Out" });
    fireEvent.click(button);

    await waitFor(() => expect(signOutMock).toHaveBeenCalledTimes(1));
    expect(pushMock).toHaveBeenCalledWith("/login");
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });
});
