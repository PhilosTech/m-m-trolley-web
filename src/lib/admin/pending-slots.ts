import type { Id, SlotWithBooking } from "@/lib/api/types";
import { timeToIsoOnEventDate } from "@/lib/config/event";

export type PendingSlotDraft = {
  clientId: string;
  startTimeHHMM: string;
  endTimeHHMM: string;
};

export function buildRowsWithPendingSlots(
  locationId: Id,
  serverRows: SlotWithBooking[],
  pending: PendingSlotDraft[] | undefined,
): SlotWithBooking[] {
  const list = pending ?? [];
  if (list.length === 0) return serverRows;
  const pendingRows: SlotWithBooking[] = list.map((row) => ({
    slot: {
      id: row.clientId,
      locationId,
      startTimeIso: timeToIsoOnEventDate(row.startTimeHHMM),
      endTimeIso: timeToIsoOnEventDate(row.endTimeHHMM),
      capacity: 50,
    },
    bookedSeats: 0,
    bookings: [],
  }));
  return [...serverRows, ...pendingRows].sort(
    (a, b) => Date.parse(a.slot.startTimeIso) - Date.parse(b.slot.startTimeIso),
  );
}
