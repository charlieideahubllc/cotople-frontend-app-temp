import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import NewEventPage from "./page";
import { createEvent } from "@/lib/api/events";
import { useSession } from "@/hooks/useSession";

function renderNewEventPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <NewEventPage />
    </QueryClientProvider>,
  );
}

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/lib/api/events", () => ({
  createEvent: vi.fn(),
}));

vi.mock("@/hooks/useSession", () => ({
  useSession: vi.fn(),
}));

const createEventMock = vi.mocked(createEvent);
const useSessionMock = vi.mocked(useSession);

beforeEach(() => {
  pushMock.mockReset();
  createEventMock.mockReset();
  useSessionMock.mockReset();
});

// Requirement: EVT-0002 AC4
describe("NewEventPage access control", () => {
  it("shows the form for an admin", () => {
    useSessionMock.mockReturnValue({ user: null, role: "admin", loading: false });

    renderNewEventPage();

    expect(screen.getByLabelText(/^Name/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Event" })).toBeInTheDocument();
  });

  it("shows the access notice, not the form, for staff", () => {
    useSessionMock.mockReturnValue({ user: null, role: "staff", loading: false });

    renderNewEventPage();

    expect(screen.getByText("You don't have access to this page.")).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Name/)).not.toBeInTheDocument();
  });
});

// Requirement: EVT-0002 AC1
describe("NewEventPage submission", () => {
  it("calls createEvent and navigates to /events on success", async () => {
    useSessionMock.mockReturnValue({ user: null, role: "admin", loading: false });
    createEventMock.mockResolvedValue({
      id: "e1",
      name: "Conference",
      starts_at: "2026-09-01T09:00:00.000Z",
      location: null,
      notes: null,
      status: "active",
      owner_profile_id: "p1",
      created_at: "2026-07-01T00:00:00.000Z",
      updated_at: "2026-07-01T00:00:00.000Z",
    });

    renderNewEventPage();
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "Conference" } });
    fireEvent.change(screen.getByLabelText(/^Date and time/), {
      target: { value: "2026-09-01T09:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Event" }));

    await waitFor(() => expect(createEventMock).toHaveBeenCalledTimes(1));
    expect(pushMock).toHaveBeenCalledWith("/events");
  });
});
