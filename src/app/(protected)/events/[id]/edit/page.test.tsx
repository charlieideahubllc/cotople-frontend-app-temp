import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import EditEventPage from "./page";
import { getEvent, updateEvent, archiveEvent } from "@/lib/api/events";
import { useSession } from "@/hooks/useSession";
import type { Event } from "@/lib/api/events.types";

function renderEditEventPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <EditEventPage />
    </QueryClientProvider>,
  );
}

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  useParams: () => ({ id: "e1" }),
}));

vi.mock("@/lib/api/events", () => ({
  getEvent: vi.fn(),
  updateEvent: vi.fn(),
  archiveEvent: vi.fn(),
}));

vi.mock("@/hooks/useSession", () => ({
  useSession: vi.fn(),
}));

const getEventMock = vi.mocked(getEvent);
const updateEventMock = vi.mocked(updateEvent);
const archiveEventMock = vi.mocked(archiveEvent);
const useSessionMock = vi.mocked(useSession);

const sampleEvent: Event = {
  id: "e1",
  name: "Trade Show",
  starts_at: "2026-08-01T10:00:00.000Z",
  location: "Hall A",
  notes: null,
  status: "active",
  owner_profile_id: "p1",
  created_at: "2026-07-01T00:00:00.000Z",
  updated_at: "2026-07-01T00:00:00.000Z",
};

beforeEach(() => {
  pushMock.mockReset();
  getEventMock.mockReset();
  updateEventMock.mockReset();
  archiveEventMock.mockReset();
  useSessionMock.mockReset();
});

// Requirement: EVT-0002 AC4
describe("EditEventPage access control", () => {
  it("shows the pre-filled form and an Archive action for an admin", async () => {
    useSessionMock.mockReturnValue({ user: null, role: "admin", loading: false });
    getEventMock.mockResolvedValue(sampleEvent);

    renderEditEventPage();

    expect(await screen.findByLabelText(/^Name/)).toHaveValue("Trade Show");
    expect(screen.getByRole("button", { name: "Archive Event" })).toBeInTheDocument();
  });

  it("shows the access notice, not the form, for staff", async () => {
    useSessionMock.mockReturnValue({ user: null, role: "staff", loading: false });
    getEventMock.mockResolvedValue(sampleEvent);

    renderEditEventPage();

    expect(screen.getByText("You don't have access to this page.")).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Name/)).not.toBeInTheDocument();
  });
});

// Requirement: EVT-0004 AC1
describe("EditEventPage archive action", () => {
  it("calls archiveEvent, not updateEvent, and navigates to /events", async () => {
    useSessionMock.mockReturnValue({ user: null, role: "admin", loading: false });
    getEventMock.mockResolvedValue(sampleEvent);
    archiveEventMock.mockResolvedValue({ ...sampleEvent, status: "archived" });

    renderEditEventPage();
    const archiveButton = await screen.findByRole("button", { name: "Archive Event" });
    fireEvent.click(archiveButton);

    await waitFor(() => expect(archiveEventMock).toHaveBeenCalledWith("e1"));
    expect(updateEventMock).not.toHaveBeenCalled();
    expect(pushMock).toHaveBeenCalledWith("/events");
  });
});
