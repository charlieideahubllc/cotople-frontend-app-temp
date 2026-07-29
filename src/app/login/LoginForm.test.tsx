import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LoginForm } from "./LoginForm";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

const signInWithPasswordMock = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { signInWithPassword: signInWithPasswordMock },
  }),
}));

beforeEach(() => {
  pushMock.mockReset();
  signInWithPasswordMock.mockReset();
});

function fillAndSubmit(email: string, password: string) {
  if (email) {
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  }
  if (password) {
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: password },
    });
  }
  fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
}

// Requirement: AUTH-0001 AC4
describe("LoginForm empty-field validation", () => {
  it("blocks submission and does not call Supabase when both fields are empty", async () => {
    render(<LoginForm redirectTo="/" />);

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Enter your email.")).toBeInTheDocument();
    expect(screen.getByText("Enter your password.")).toBeInTheDocument();
    expect(signInWithPasswordMock).not.toHaveBeenCalled();
  });
});

// Requirement: AUTH-0001 AC3
describe("LoginForm failed sign-in", () => {
  it("shows a single generic error message on invalid credentials", async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "Invalid login credentials" },
    });
    render(<LoginForm redirectTo="/" />);

    fillAndSubmit("user@example.com", "wrong-password");

    expect(
      await screen.findByText("Invalid email or password. Please try again."),
    ).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });
});

// Requirement: AUTH-0001 AC1, AC2 (redirect on success)
describe("LoginForm successful sign-in", () => {
  it("redirects to redirectTo on success", async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: { user: { id: "u1" }, session: {} },
      error: null,
    });
    render(<LoginForm redirectTo="/next-page" />);

    fillAndSubmit("user@example.com", "correct-password");

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/next-page"));
    expect(signInWithPasswordMock).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "correct-password",
    });
  });
});

// Requirement: AUTH-0001 AC5
describe("LoginForm submit state", () => {
  it("disables the submit button while the request is pending", async () => {
    let resolveSignIn: (value: {
      data: { user: null; session: null };
      error: null;
    }) => void = () => {};
    signInWithPasswordMock.mockReturnValue(
      new Promise((resolve) => {
        resolveSignIn = resolve;
      }),
    );
    render(<LoginForm redirectTo="/" />);

    fillAndSubmit("user@example.com", "some-password");

    expect(screen.getByRole("button", { name: "Signing in..." })).toBeDisabled();

    resolveSignIn({ data: { user: null, session: null }, error: null });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /sign in/i })).not.toBeDisabled(),
    );
  });
});
