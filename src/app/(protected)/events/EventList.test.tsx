import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EventList } from "./EventList";
import { listEvents } from "@/lib/api/events";
import { useSession } from "@/hooks/useSession";
import type { SessionState } from "@/hooks/useSession";
import type { Event } from "@/lib/api/events.types";
import type { EventListResult } from "@/lib/api/events";

vi.mock("@/lib/api/events", () => ({
  listEvents: vi.fn(),
}));

vi.mock("@/hooks/useSession", () => ({
  useSession: vi.fn(),
}));

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

const listEventsMock = vi.mocked(listEvents);
const useSessionMock = vi.mocked(useSession);

function renderEventList() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <EventList />
    </QueryClientProvider>,
  );
}

function eventListResult(items: Event[], total = items.length): EventListResult {
  return { items, total, limit: 10, offset: 0 };
}

const sampleEvent: Event = {
  id: "e1",
  name: "Trade Show",
  starts_at: "2026-08-01T10:00:00.000Z",
  location: null,
  notes: null,
  status: "active",
  owner_profile_id: "p1",
  created_at: "2026-07-01T00:00:00.000Z",
  updated_at: "2026-07-01T00:00:00.000Z",
};

function makeEvent(id: string): Event {
  return { ...sampleEvent, id, name: `Event ${id}` };
}

beforeEach(() => {
  listEventsMock.mockReset();
  useSessionMock.mockReset();
  useSessionMock.mockReturnValue({ user: null, role: "staff", loading: false });
  pushMock.mockReset();
});

// Requirement: EVT-0001 AC1, AC2
describe("EventList success", () => {
  it("renders the fetched events", async () => {
    listEventsMock.mockResolvedValue(eventListResult([sampleEvent]));

    renderEventList();

    expect(await screen.findByText("Trade Show")).toBeInTheDocument();
  });
});

// Requirement: EVT-0001 AC5
describe("EventList empty state", () => {
  it("shows an empty state, not an error, when there are no active events", async () => {
    listEventsMock.mockResolvedValue(eventListResult([]));

    renderEventList();

    expect(await screen.findByText("No active events yet.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

// Requirement: EVT-0001 AC4
describe("EventList error state", () => {
  it("shows an error with a working retry action", async () => {
    listEventsMock.mockRejectedValueOnce(new Error("Network error"));
    listEventsMock.mockResolvedValueOnce(eventListResult([sampleEvent]));

    renderEventList();

    expect(await screen.findByRole("alert")).toHaveTextContent("Network error");

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Trade Show")).toBeInTheDocument();
    expect(listEventsMock).toHaveBeenCalledTimes(2);
  });
});

// Requirement: EVT-0001 AC6 (Admin-only "New Event" link)
describe("EventList role-gated New Event link", () => {
  it("shows the New Event link for an admin", async () => {
    useSessionMock.mockReturnValue({ user: null, role: "admin", loading: false });
    listEventsMock.mockResolvedValue(eventListResult([]));

    renderEventList();

    await waitFor(() => expect(listEventsMock).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "New Event" })).toBeInTheDocument();
  });

  it("hides the New Event link for staff", async () => {
    useSessionMock.mockReturnValue({ user: null, role: "staff", loading: false });
    listEventsMock.mockResolvedValue(eventListResult([]));

    renderEventList();

    await waitFor(() => expect(listEventsMock).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "New Event" })).not.toBeInTheDocument();
  });
});

// Requirement: EVT-0001 AC3 (event detail screen, which now owns the
// Edit/Capture actions previously duplicated per-row here — see
// events/[id]/page.tsx). The event name is a real <Link> for proper
// keyboard/screen-reader access; the row's own onClick is a mouse-only
// convenience for clicking elsewhere in the row (a `role="link"` on the
// <tr> itself was non-standard ARIA and has been removed).
describe("EventList row navigation (event detail)", () => {
  it("renders the event name as a real link to the event detail page", async () => {
    listEventsMock.mockResolvedValue(eventListResult([sampleEvent]));

    renderEventList();

    const nameLink = await screen.findByRole("link", { name: "Trade Show" });
    expect(nameLink).toHaveAttribute("href", "/events/e1");
  });

  it("navigates via router.push when clicking the row outside the name link", async () => {
    listEventsMock.mockResolvedValue(eventListResult([sampleEvent]));

    renderEventList();

    fireEvent.click(await screen.findByText("active"));

    expect(pushMock).toHaveBeenCalledWith("/events/e1");
  });

  it("clicking the name link does not also trigger the row's own navigation", async () => {
    listEventsMock.mockResolvedValue(eventListResult([sampleEvent]));

    renderEventList();

    fireEvent.click(await screen.findByRole("link", { name: "Trade Show" }));

    expect(pushMock).not.toHaveBeenCalled();
  });
});

// Requirement: EVT-0003 AC1 (10 rows/page, server-side pagination)
describe("EventList pagination", () => {
  it("requests page 1 (offset 0) on initial render and hides pagination when everything fits on one page", async () => {
    listEventsMock.mockResolvedValue(eventListResult([sampleEvent], 1));

    renderEventList();

    await screen.findByText("Trade Show");
    expect(listEventsMock).toHaveBeenCalledWith({ limit: 10, offset: 0 });
    expect(screen.queryByRole("navigation", { name: "pagination" })).not.toBeInTheDocument();
  });

  it("shows pagination and requests the next page's offset on click", async () => {
    const page1 = Array.from({ length: 10 }, (_, i) => makeEvent(`p1-${i}`));
    const page2 = [makeEvent("p2-0")];
    listEventsMock.mockImplementation(async ({ offset } = {}) =>
      offset === 10 ? eventListResult(page2, 11) : eventListResult(page1, 11),
    );

    renderEventList();

    await screen.findByText("Event p1-0");
    expect(screen.getByRole("navigation", { name: "pagination" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Go to next page" }));

    await screen.findByText("Event p2-0");
    expect(listEventsMock).toHaveBeenCalledWith({ limit: 10, offset: 10 });
  });
});

// EVT-0003 AC1 extension: filter to events owned by the signed-in user.
describe("EventList owner filter", () => {
  it("disables the My Events toggle until the session resolves a user", async () => {
    useSessionMock.mockReturnValue({ user: null, role: "staff", loading: false });
    listEventsMock.mockResolvedValue(eventListResult([sampleEvent]));

    renderEventList();

    await screen.findByText("Trade Show");
    expect(screen.getByRole("button", { name: "All Events" })).toBeDisabled();
  });

  it("defaults to All Events and switches to My Events (owner_id=the signed-in user's id) on toggle", async () => {
    useSessionMock.mockReturnValue({
      user: { id: "u1" } as unknown as SessionState["user"],
      role: "staff",
      loading: false,
    });
    listEventsMock.mockResolvedValue(eventListResult([sampleEvent]));

    renderEventList();

    await screen.findByText("Trade Show");
    expect(listEventsMock).toHaveBeenCalledWith({ limit: 10, offset: 0, ownerId: undefined });

    fireEvent.click(screen.getByRole("button", { name: "All Events" }));

    await waitFor(() =>
      expect(listEventsMock).toHaveBeenCalledWith({ limit: 10, offset: 0, ownerId: "u1" }),
    );
    expect(screen.getByRole("button", { name: "My Events" })).toBeInTheDocument();
  });
});
