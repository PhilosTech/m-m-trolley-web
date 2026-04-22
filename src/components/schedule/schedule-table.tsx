"use client";

import { useMemo, useState } from "react";
import type { SlotWithBooking } from "@/lib/api/types";
import { Button } from "@/components/ui/button";

type AdminAction = "slot" | "participants";

function formatTimeRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const fmt = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/London",
  });
  return `${fmt.format(start)}–${fmt.format(end)}`;
}

type Props = {
  rows: SlotWithBooking[];
  mode: "participant" | "admin";
  onReserve?: (timeSlotId: string, seats: number) => void;
  onClear?: (timeSlotId: string) => void;
  onDeleteSlot?: (timeSlotId: string) => void;
  onAdminAddParticipant?: (timeSlotId: string) => void;
  onAdminDeleteBooking?: (bookingId: string) => void;
  isReserveDisabled?: boolean;
  isBusy?: boolean;
  showActions?: boolean;
  showParticipants?: boolean;
  participantAction?: "stepper" | "plus";
  adminAction?: AdminAction;
  /** Slots not yet persisted (shown next to time in admin mode). */
  draftSlotIds?: ReadonlySet<string>;
};

export function ScheduleTable({
  rows,
  mode,
  onReserve,
  onClear,
  onDeleteSlot,
  onAdminAddParticipant,
  onAdminDeleteBooking,
  isReserveDisabled,
  isBusy,
  showActions = true,
  showParticipants = true,
  participantAction = "stepper",
  adminAction = "slot",
  draftSlotIds,
}: Props) {
  const initialSeats = useMemo(() => {
    const next: Record<string, number> = {};
    for (const r of rows) next[r.slot.id] = 1;
    return next;
  }, [rows]);

  const [seatsBySlotId, setSeatsBySlotId] = useState<Record<string, number>>(
    () => initialSeats,
  );

  function getFillClasses(bookedSeats: number): string {
    if (bookedSeats <= 0) return "bg-sky-100";
    if (bookedSeats === 1) return "bg-amber-100";
    return "bg-emerald-100";
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-700">
        No time slots yet.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200">
      {/* Mobile: stacked list */}
      <div className="divide-y divide-zinc-200 bg-white sm:hidden">
        {rows.map(({ slot, bookedSeats, bookings }) => {
          const free = Math.max(0, slot.capacity - bookedSeats);
          const canReserve = free >= 1;
          const fillClasses = getFillClasses(bookedSeats);
          return (
            <div key={slot.id} className={`p-4 ${fillClasses}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-zinc-900">
                  <span>{formatTimeRange(slot.startTimeIso, slot.endTimeIso)}</span>
                  {mode === "admin" && draftSlotIds?.has(slot.id) ? (
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900">
                      Draft
                    </span>
                  ) : null}
                </div>

                {showActions ? (
                  mode === "participant" && participantAction === "plus" ? (
                    <button
                      type="button"
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-base font-semibold text-white disabled:bg-zinc-400"
                      disabled={!canReserve || isBusy || isReserveDisabled}
                      onClick={() => onReserve?.(slot.id, 1)}
                      aria-label="Reserve"
                    >
                      +
                    </button>
                  ) : mode === "admin" && adminAction === "participants" ? (
                    <button
                      type="button"
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-base font-semibold text-white disabled:bg-zinc-400"
                      disabled={isBusy || !onAdminAddParticipant}
                      onClick={() => onAdminAddParticipant?.(slot.id)}
                      aria-label="Add participant"
                    >
                      +
                    </button>
                  ) : null
                ) : null}
              </div>

              {showParticipants ? (
                <div className="mt-3">
                  {bookings.length === 0 ? (
                    <div className="text-sm text-zinc-500">No participants yet</div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {bookings.map((b) => (
                        <span
                          key={b.id}
                          className="max-w-full wrap-break-word inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs text-zinc-800"
                        >
                          {b.participantName}
                          {mode === "admin" &&
                          adminAction === "participants" &&
                          onAdminDeleteBooking ? (
                            <button
                              type="button"
                              className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-[11px] font-semibold text-white hover:bg-black/80 disabled:opacity-50"
                              onClick={() => onAdminDeleteBooking(b.id)}
                              aria-label="Remove participant"
                              disabled={isBusy}
                            >
                              ×
                            </button>
                          ) : null}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}

              {showActions && mode === "admin" ? (
                adminAction === "participants" ? null : (
                  <div className="mt-3 flex flex-col gap-2">
                    {onClear ? (
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={bookings.length === 0 || isBusy}
                        onClick={() => onClear(slot.id)}
                        aria-label="Clear bookings for this slot"
                      >
                        Clear
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="danger"
                      disabled={isBusy || !onDeleteSlot}
                      onClick={() => onDeleteSlot?.(slot.id)}
                      aria-label="Delete this time slot"
                    >
                      Delete
                    </Button>
                  </div>
                )
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Desktop/tablet: table */}
      <div className="hidden sm:block">
        <table className="w-full text-left text-sm">
        <thead className="bg-zinc-50 text-zinc-700">
          <tr>
            <th className="px-4 py-3 font-medium">Time</th>
            {showParticipants ? (
              <th className="px-4 py-3 font-medium">Participants</th>
            ) : null}
            {showActions ? <th className="px-4 py-3 font-medium">Actions</th> : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 bg-white">
          {rows.map(({ slot, bookedSeats, bookings }) => {
            const free = Math.max(0, slot.capacity - bookedSeats);
            const currentSeats = Math.min(
              Math.max(1, seatsBySlotId[slot.id] ?? 1),
              Math.max(1, free),
            );
            const canReserve = free >= 1;
            const fillClasses = getFillClasses(bookedSeats);

            return (
              <tr key={slot.id} className={`align-top ${fillClasses}`}>
                <td className="px-4 py-3 font-medium text-zinc-900">
                  <div className="flex flex-wrap items-center gap-2">
                    <span>{formatTimeRange(slot.startTimeIso, slot.endTimeIso)}</span>
                    {mode === "admin" && draftSlotIds?.has(slot.id) ? (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900">
                        Draft
                      </span>
                    ) : null}
                  </div>
                </td>
                {showParticipants ? (
                  <td className="px-4 py-3 text-zinc-700">
                    {bookings.length === 0 ? (
                      <span className="text-zinc-400">No participants yet</span>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {bookings.map((b) => (
                          <span
                            key={b.id}
                            className="max-w-full wrap-break-word inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs text-zinc-800"
                          >
                            {b.participantName}
                            {mode === "admin" &&
                            adminAction === "participants" &&
                            onAdminDeleteBooking ? (
                              <button
                                type="button"
                                className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-[11px] font-semibold text-white hover:bg-black/80 disabled:opacity-50"
                                onClick={() => onAdminDeleteBooking(b.id)}
                                aria-label="Remove participant"
                                disabled={isBusy}
                              >
                                ×
                              </button>
                            ) : null}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                ) : null}
                {showActions ? (
                  <td className="px-4 py-3 align-middle">
                    {mode === "participant" ? (
                      participantAction === "plus" ? (
                        <div className="flex items-center justify-end">
                          <button
                            type="button"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 text-base font-semibold text-white disabled:bg-zinc-400 sm:h-10 sm:w-10 sm:text-lg"
                            disabled={!canReserve || isBusy || isReserveDisabled}
                            onClick={() => onReserve?.(slot.id, 1)}
                            aria-label="Reserve"
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <div className="inline-flex items-center rounded-xl border border-zinc-200">
                            <button
                              type="button"
                              className="h-9 w-9 rounded-l-xl text-sm font-medium text-zinc-900 disabled:text-zinc-300"
                              onClick={() =>
                                setSeatsBySlotId((prev) => ({
                                  ...prev,
                                  [slot.id]: Math.max(1, (prev[slot.id] ?? 1) - 1),
                                }))
                              }
                              disabled={!canReserve || isBusy || currentSeats <= 1}
                              aria-label="Decrease seats"
                            >
                              −
                            </button>
                            <div
                              className="min-w-10 px-2 text-center text-sm text-zinc-900"
                              aria-label="Selected seats"
                            >
                              {currentSeats}
                            </div>
                            <button
                              type="button"
                              className="h-9 w-9 rounded-r-xl text-sm font-medium text-zinc-900 disabled:text-zinc-300"
                              onClick={() =>
                                setSeatsBySlotId((prev) => ({
                                  ...prev,
                                  [slot.id]: Math.min(
                                    free,
                                    Math.max(1, (prev[slot.id] ?? 1) + 1),
                                  ),
                                }))
                              }
                              disabled={!canReserve || isBusy || currentSeats >= free}
                              aria-label="Increase seats"
                            >
                              +
                            </button>
                          </div>
                          <Button
                            type="button"
                            variant="primary"
                            disabled={!canReserve || isBusy}
                            onClick={() => onReserve?.(slot.id, currentSeats)}
                            aria-label="Reserve selected seats"
                          >
                            Reserve
                          </Button>
                          <div className="text-xs text-zinc-500">Free: {free}</div>
                        </div>
                      )
                    ) : (
                      adminAction === "participants" ? (
                        <div className="flex items-center justify-end">
                          <button
                            type="button"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 text-base font-semibold text-white disabled:bg-zinc-400 sm:h-10 sm:w-10 sm:text-lg"
                            disabled={isBusy || !onAdminAddParticipant}
                            onClick={() => onAdminAddParticipant?.(slot.id)}
                            aria-label="Add participant"
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2 sm:flex-row">
                          {onClear ? (
                            <Button
                              type="button"
                              variant="secondary"
                              disabled={bookings.length === 0 || isBusy}
                              onClick={() => onClear(slot.id)}
                              aria-label="Clear bookings for this slot"
                            >
                              Clear
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            variant="danger"
                            disabled={isBusy || !onDeleteSlot}
                            onClick={() => onDeleteSlot?.(slot.id)}
                            aria-label="Delete this time slot"
                          >
                            Delete
                          </Button>
                        </div>
                      )
                    )}
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
        </table>
      </div>
    </div>
  );
}

