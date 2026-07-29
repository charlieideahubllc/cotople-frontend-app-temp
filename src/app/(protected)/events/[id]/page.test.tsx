import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import EventDetailPage from "./page";
import { getEvent } from "@/lib/api/events";
import { listEventContacts } from "@/lib/api/contacts";
import { listEventOccurrences } from "@/lib/api/event-occurrences";
import { useSession } from "@/hooks/useSession";
import type { ContactWithOccurrence } from "@/lib/api/contacts";
import type { Event } from "@/lib/api/events.types";
import type { Contact } from "@/lib/api/contacts.types";
import type { EventOccurrenceItem } from "@/lib/api/event-occurrences.types";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "e1" }),
}));

vi.mock("@/lib/api/events", () => ({
  getEvent: vi.fn(),
}));

vi.mock("@/lib/api/contacts", () => ({
  listEventContacts: vi.fn(),
}));

vi.mock("@/lib/api/event-occurrences", () => ({
  listEventOccurrences: vi.fn(),
}));

vi.mock("@/hooks/useSession", () => ({
  useSession: vi.fn(),
}));

const getEventMock = vi.mocked(getEvent);
const listEventContactsMock = vi.mocked(listEventContacts);
const listEventOccurrencesMock = vi.mocked(listEventOccurrences);
const useSessionMock = vi.mocked(useSession);

function occurrenceItem(overrides: Partial<EventOccurrenceItem> = {}): EventOccurrenceItem {
  return {
    id: "occ-1",
    event_id: "e1",
    contact_id: "c1",
    captured_by_profile_id: "p1",
    captured_at: "2026-07-27T10:00:00.000Z",
    capture_method: "image",
    notes: null,
    contact_image_id: "img-1",
    duplicate_resolution: "new",
    ghl_sync_status: "pending",
    business_card_image_url: null,
    selfie_image_url: null,
    ...overrides,
  };
}

const sampleEvent: Event = {
  id: "e1",
  name: "Trade Show",
  starts_at: "2026-08-01T10:00:00.000Z",
  location: "Hall B",
  notes: null,
  status: "active",
  owner_profile_id: "p1",
  created_at: "2026-07-01T00:00:00.000Z",
  updated_at: "2026-07-01T00:00:00.000Z",
};

const sampleContact: Contact = {
  id: "c1",
  first_name: "Ada",
  last_name: "Lovelace",
  company: "Analytical Engines Ltd",
  position: "Engineer",
  phone: "+15551234567",
  email: null,
  website: null,
  address: null,
  created_at: "2026-07-27T00:00:00.000Z",
  updated_at: "2026-07-27T00:00:00.000Z",
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <EventDetailPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  getEventMock.mockReset();
  listEventContactsMock.mockReset();
  listEventOccurrencesMock.mockReset();
  listEventOccurrencesMock.mockResolvedValue({ items: [], total: 0, limit: 200, offset: 0 });
  useSessionMock.mockReset();
  useSessionMock.mockReturnValue({ user: null, role: "staff", loading: false });
});

describe("EventDetailPage", () => {
  it("shows the event name/date and an empty state when no contacts were captured", async () => {
    getEventMock.mockResolvedValue(sampleEvent);
    listEventContactsMock.mockResolvedValue([]);

    renderPage();

    expect(await screen.findByText("Trade Show")).toBeInTheDocument();
    expect(await screen.findByText("No contacts captured at this event yet.")).toBeInTheDocument();
  });

  it("shows the event notes when present", async () => {
    getEventMock.mockResolvedValue({ ...sampleEvent, notes: "Bring extra badges" });
    listEventContactsMock.mockResolvedValue([]);

    renderPage();

    expect(await screen.findByText("Bring extra badges")).toBeInTheDocument();
  });

  it("does not render a notes line when the event has no notes", async () => {
    getEventMock.mockResolvedValue(sampleEvent);
    listEventContactsMock.mockResolvedValue([]);

    renderPage();

    await screen.findByText("Trade Show");
    expect(screen.queryByText("Bring extra badges")).not.toBeInTheDocument();
  });

  it("lists contacts with their capture method, and shows an image indicator when one is on file", async () => {
    getEventMock.mockResolvedValue(sampleEvent);
    const rows: ContactWithOccurrence[] = [
      {
        contact: sampleContact,
        occurrence: {
          id: "occ-1",
          event_id: "e1",
          contact_id: "c1",
          captured_by_profile_id: "p1",
          captured_at: "2026-07-27T10:00:00.000Z",
          capture_method: "image",
          notes: null,
          contact_image_id: "img-1",
          duplicate_resolution: "new",
          ghl_sync_status: "pending",
        },
      },
    ];
    listEventContactsMock.mockResolvedValue(rows);

    renderPage();

    expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("Business card scan")).toBeInTheDocument();
    expect(screen.getByText("Image on file")).toBeInTheDocument();
  });

  it("does not show the image indicator when no image is on file", async () => {
    getEventMock.mockResolvedValue(sampleEvent);
    listEventContactsMock.mockResolvedValue([
      {
        contact: sampleContact,
        occurrence: {
          id: "occ-1",
          event_id: "e1",
          contact_id: "c1",
          captured_by_profile_id: "p1",
          captured_at: "2026-07-27T10:00:00.000Z",
          capture_method: "manual",
          notes: null,
          contact_image_id: null,
          duplicate_resolution: "new",
          ghl_sync_status: "pending",
        },
      },
    ]);

    renderPage();

    expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.queryByText("Image on file")).not.toBeInTheDocument();
  });

  // Requirement: EIF-0005 AC2, AC3, AC4
  it("renders the business-card image directly from a returned local-download-shaped URL", async () => {
    getEventMock.mockResolvedValue(sampleEvent);
    listEventContactsMock.mockResolvedValue([
      {
        contact: sampleContact,
        occurrence: {
          id: "occ-1",
          event_id: "e1",
          contact_id: "c1",
          captured_by_profile_id: "p1",
          captured_at: "2026-07-27T10:00:00.000Z",
          capture_method: "image",
          notes: null,
          contact_image_id: "img-1",
          duplicate_resolution: "new",
          ghl_sync_status: "pending",
        },
      },
    ]);
    listEventOccurrencesMock.mockResolvedValue({
      items: [
        occurrenceItem({
          id: "occ-1",
          business_card_image_url:
            "https://api.example.com/api/v1/images/local-download/signed-token-abc",
        }),
      ],
      total: 1,
      limit: 200,
      offset: 0,
    });

    renderPage();

    const image = await screen.findByAltText("Business card for Ada Lovelace");
    // A plain <img> tag never attaches an Authorization header on its own —
    // the URL's embedded token is the entire access control (API_REFERENCE.md),
    // so rendering it directly (no fetch/axios wrapper) is exactly correct.
    expect(image).toHaveAttribute(
      "src",
      "https://api.example.com/api/v1/images/local-download/signed-token-abc",
    );
    expect(screen.queryByText("Image on file")).not.toBeInTheDocument();
  });

  // Requirement: EIF-0005 AC3
  it("shows the existing no-preview state, not an error, when business_card_image_url is null", async () => {
    getEventMock.mockResolvedValue(sampleEvent);
    listEventContactsMock.mockResolvedValue([
      {
        contact: sampleContact,
        occurrence: {
          id: "occ-1",
          event_id: "e1",
          contact_id: "c1",
          captured_by_profile_id: "p1",
          captured_at: "2026-07-27T10:00:00.000Z",
          capture_method: "image",
          notes: null,
          contact_image_id: "img-1",
          duplicate_resolution: "new",
          ghl_sync_status: "pending",
        },
      },
    ]);
    listEventOccurrencesMock.mockResolvedValue({
      items: [occurrenceItem({ id: "occ-1", business_card_image_url: null })],
      total: 1,
      limit: 200,
      offset: 0,
    });

    renderPage();

    expect(await screen.findByText("Image on file")).toBeInTheDocument();
    expect(
      screen.queryByAltText("Business card for Ada Lovelace"),
    ).not.toBeInTheDocument();
  });

  it("shows an error state with retry when the contacts query fails", async () => {
    getEventMock.mockResolvedValue(sampleEvent);
    listEventContactsMock.mockRejectedValue(new Error("Network error"));

    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("Network error");
  });
});

describe("EventDetailPage Edit action (Admin-only)", () => {
  it("shows an Edit link to the event's edit page for an admin", async () => {
    useSessionMock.mockReturnValue({ user: null, role: "admin", loading: false });
    getEventMock.mockResolvedValue(sampleEvent);
    listEventContactsMock.mockResolvedValue([]);

    renderPage();

    const editLink = await screen.findByRole("button", { name: /Edit/ });
    expect(editLink).toHaveAttribute("href", "/events/e1/edit");
  });

  it("hides the Edit link for staff", async () => {
    useSessionMock.mockReturnValue({ user: null, role: "staff", loading: false });
    getEventMock.mockResolvedValue(sampleEvent);
    listEventContactsMock.mockResolvedValue([]);

    renderPage();

    await screen.findByText("Trade Show");
    expect(screen.queryByRole("button", { name: /Edit/ })).not.toBeInTheDocument();
  });
});
