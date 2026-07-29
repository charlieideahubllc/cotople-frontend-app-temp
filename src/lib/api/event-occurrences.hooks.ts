// Requirement: EIF-0005 AC2, AC3, AC4
import { useQuery } from "@tanstack/react-query";
import { listEventOccurrences } from "./event-occurrences";
import type { EventOccurrenceItem } from "./event-occurrences.types";

const EVENT_OCCURRENCES_PAGE_SIZE = 200;

// Scoped to a single event, fetching every page up front — pilot-sized
// data, same acceptable-for-now scale assumption as contacts.ts's
// listEventContacts. Only enabled once a real eventId exists, since this
// component is also used from the event-create page where no event exists
// yet (mirrors ManualCaptureForm's own eventId-optional pattern).
export function useEventOccurrencesQuery(eventId: string | undefined) {
  return useQuery({
    queryKey: ["event-occurrences", eventId],
    queryFn: async () => {
      const items: EventOccurrenceItem[] = [];
      let offset = 0;
      for (;;) {
        const page = await listEventOccurrences({
          eventId,
          limit: EVENT_OCCURRENCES_PAGE_SIZE,
          offset,
        });
        items.push(...page.items);
        offset += EVENT_OCCURRENCES_PAGE_SIZE;
        if (page.items.length === 0 || offset >= page.total) {
          break;
        }
      }
      return items;
    },
    enabled: Boolean(eventId),
  });
}
