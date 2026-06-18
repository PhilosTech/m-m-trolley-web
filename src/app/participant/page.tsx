"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api/client";
import type { BookingPolicy, Id, Location, Session, SlotWithBooking } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loadSession, saveSession } from "@/lib/session/session";
import { ScheduleTable } from "@/components/schedule/schedule-table";
import { Modal } from "@/components/ui/modal";
import { PhotoGallery } from "@/components/location/photo-gallery";

type ViewState =
  | { status: "auth" }
  | { status: "loading" }
  | { status: "ready" }
  | { status: "error"; message: string };

export default function ParticipantPage() {
  const [accessCode, setAccessCode] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [state, setState] = useState<ViewState>({ status: "auth" });

  const [locations, setLocations] = useState<Location[]>([]);
  const [expandedLocationId, setExpandedLocationId] = useState<Id | null>(null);
  const [scheduleByLocationId, setScheduleByLocationId] = useState<
    Record<string, SlotWithBooking[]>
  >({});
  const [bookingPolicy, setBookingPolicy] = useState<BookingPolicy | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [reserveNotice, setReserveNotice] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pendingSlotId, setPendingSlotId] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  // Keep this logic inside the effect to avoid hook dependency churn.
  async function refreshSchedule(locationId: Id) {
    const res = await apiClient.getSchedule(locationId);
    if (!res.ok) {
      setState({ status: "error", message: res.error.message });
      return;
    }
    setScheduleByLocationId((prev) => ({ ...prev, [locationId]: res.data }));
  }

  async function refreshBookingPolicy(): Promise<BookingPolicy | null> {
    const res = await apiClient.getPublicBookingPolicy();
    if (!res.ok) {
      setState({ status: "error", message: res.error.message });
      return null;
    }
    setBookingPolicy(res.data);
    return res.data;
  }

  async function loadInitial(prevExpandedId: Id | null) {
    const locRes = await apiClient.listLocations();
    if (!locRes.ok) {
      setState({ status: "error", message: locRes.error.message });
      return;
    }
    await refreshBookingPolicy();
    const published = locRes.data.filter((l) => l.status === "published");
    setLocations(published);
    const nextExpanded = (() => {
      if (prevExpandedId && published.some((l) => l.id === prevExpandedId)) return prevExpandedId;
      return published[0]?.id ?? null;
    })();
    setExpandedLocationId(nextExpanded);
    if (nextExpanded) {
      await refreshSchedule(nextExpanded);
    }
    setState({ status: "ready" });
  }

  useEffect(() => {
    const t = window.setTimeout(() => {
      const s = loadSession();
      if (s?.role === "participant") {
        setSession(s);
        setState({ status: "loading" });
        void loadInitial(null);
      }
    }, 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (state.status !== "ready" || !session) return;
    if (!expandedLocationId) return;
    if (scheduleByLocationId[expandedLocationId] !== undefined) return;
    queueMicrotask(() => {
      void refreshSchedule(expandedLocationId);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status, session, expandedLocationId, locations]);

  useEffect(() => {
    if (state.status !== "ready" || !session) return;
    if (!expandedLocationId) return;
    const t = window.setInterval(() => {
      void refreshBookingPolicy();
      void refreshSchedule(expandedLocationId);
    }, 5000);
    return () => window.clearInterval(t);
  }, [state.status, session, expandedLocationId]);

  async function login() {
    setIsBusy(true);
    const res = await apiClient.login("participant", accessCode);
    if (!res.ok) {
      setState({ status: "error", message: res.error.message });
      setIsBusy(false);
      return;
    }
    saveSession(res.data);
    setSession(res.data);
    setState({ status: "loading" });
    await loadInitial(expandedLocationId);
    setIsBusy(false);
  }

  async function toggleExpanded(locationId: Id) {
    setExpandedLocationId(locationId);
    await refreshSchedule(locationId);
  }

  async function handleReserveClick(locationId: Id, timeSlotId: string) {
    setReserveNotice(null);
    const latestPolicy = await refreshBookingPolicy();
    const p = latestPolicy ?? bookingPolicy;
    const isLocked = !!p?.isGlobalLocked || !!p?.lockedLocationIds.includes(locationId);
    if (isLocked) {
      setReserveNotice("Volunteer sign-up is closed by the co-ordinator.");
      return;
    }
    setPendingSlotId(timeSlotId);
    setIsModalOpen(true);
  }

  function closeReserveModal() {
    setIsModalOpen(false);
    setPendingSlotId(null);
  }

  async function reserve() {
    if (!session || session.role !== "participant") {
      setState({ status: "error", message: "Volunteer session required." });
      return;
    }
    if (!pendingSlotId) return;
    const fullName = `${firstName} ${lastName}`.trim().replaceAll(/\s+/g, " ");
    if (fullName.length < 2) {
      setState({ status: "error", message: "Please enter your first and last name." });
      return;
    }
    setIsBusy(true);
    const res = await apiClient.reserve("participant", {
      timeSlotId: pendingSlotId,
      participantName: fullName,
      seats: 1,
    });
    if (!res.ok) {
      setState({ status: "error", message: res.error.message });
      setIsBusy(false);
      return;
    }

    for (const loc of locations) {
      if (!scheduleByLocationId[loc.id]) continue;
      await refreshSchedule(loc.id);
    }
    setIsBusy(false);
    setState({ status: "ready" });
    closeReserveModal();
  }

  return (
    <div className="min-h-full overflow-x-clip bg-zinc-50 px-4 py-10 text-zinc-950 sm:px-6">
      <div className="mx-auto w-full min-w-0 max-w-5xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm text-zinc-600">
              <Link href="/" className="underline">
                Home
              </Link>{" "}
              / Volunteer
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Volunteer</h1>
            <p className="mt-1 text-sm text-zinc-600">
              Choose a trolley location and sign up for a shift.
            </p>
          </div>
        </div>

        {state.status === "auth" || state.status === "error" ? (
          <div className="mt-6 grid gap-4 rounded-2xl border border-zinc-200 bg-white p-6">
            {state.status === "error" ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {state.message}
              </div>
            ) : null}
            <Input
              label="Volunteer access code"
              type="password"
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value)}
              placeholder="Enter code"
              autoComplete="current-password"
            />
            <div className="flex items-center gap-3">
              <Button type="button" onClick={() => void login()} disabled={isBusy}>
                Continue
              </Button>
            </div>
          </div>
        ) : null}

        {state.status !== "auth" ? (
          <div className="mt-6 grid gap-4 rounded-2xl border border-zinc-200 bg-white p-6">
            {state.status === "error" ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {state.message}
              </div>
            ) : null}

            {state.status === "loading" ? (
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
                Loading…
              </div>
            ) : locations.length === 0 ? (
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
                No published trolley locations yet. Ask the co-ordinator to publish one.
              </div>
            ) : (
              <div className="grid gap-4">
                {locations.map((loc) => {
                  const isExpanded = expandedLocationId === loc.id;
                  const rows = scheduleByLocationId[loc.id] ?? [];
                  const isLockedForThisPlace =
                    !!bookingPolicy?.isGlobalLocked ||
                    !!bookingPolicy?.lockedLocationIds.includes(loc.id);

                  return (
                    <div
                      key={loc.id}
                      className="min-w-0 overflow-hidden rounded-2xl border border-zinc-200 bg-white"
                    >
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-100 px-4 py-4 text-left transition hover:bg-zinc-200/80 sm:gap-4 sm:px-5"
                        onClick={() => void toggleExpanded(loc.id)}
                        aria-label="Toggle place"
                      >
                        <div className="min-w-0">
                          <div className="text-base font-semibold text-zinc-900 line-clamp-2 sm:line-clamp-1">
                            {loc.title?.trim().length ? loc.title : "Untitled location"}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center justify-center gap-2 text-zinc-700">
                          <span className="hidden text-base font-semibold sm:inline">
                            {isExpanded ? "Hide" : "Show"}
                          </span>
                          <span className="text-base leading-none" aria-hidden="true">
                            {isExpanded ? "▲" : "▼"}
                          </span>
                        </div>
                      </button>

                      {isExpanded ? (
                        <div className="min-w-0 border-t border-zinc-200 px-4 py-5 sm:px-5">
                          <div className="grid gap-4">
                            <div>
                              <div className="text-lg font-semibold text-zinc-900">
                                {loc.title?.trim().length ? loc.title : "Untitled location"}
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                              {loc.googleMapsUrl ? (
                                <a
                                  className="text-sm underline"
                                  href={loc.googleMapsUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Open in Google Maps
                                </a>
                              ) : (
                                <span className="text-sm text-zinc-500">No Google Maps link</span>
                              )}
                            </div>

                            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                              <div className="text-sm font-semibold text-zinc-900">Photos</div>
                              <div className="mt-3">
                                <PhotoGallery photoUrls={loc.photoUrls} />
                              </div>
                            </div>

                            <div className="text-sm text-zinc-700">
                              Tap <span className="font-semibold">+</span> to sign up for a
                              shift.
                            </div>

                            {isLockedForThisPlace ? (
                              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
                                Volunteer sign-up is closed by the co-ordinator.
                              </div>
                            ) : reserveNotice ? (
                              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
                                {reserveNotice}
                              </div>
                            ) : null}

                            <ScheduleTable
                              rows={rows}
                              mode="participant"
                              onReserve={(slotId) => void handleReserveClick(loc.id, slotId)}
                              isBusy={isBusy}
                              participantAction="plus"
                              showParticipants
                              showActions
                              isReserveDisabled={isLockedForThisPlace}
                            />

                            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
                              <div className="font-semibold text-zinc-900">Good to know</div>
                              <div className="mt-2 grid gap-2">
                                <div>
                                  There is no hard limit. We usually need at least{" "}
                                  <span className="font-semibold">2</span> volunteers per shift;{" "}
                                  <span className="font-semibold">3</span> is fine, and{" "}
                                  <span className="font-semibold">4</span> is also OK if needed
                                  (for example, with a child).
                                </div>
                                <div>
                                  If your plans change and you need to{" "}
                                  <span className="font-semibold">remove</span>{" "}
                                  yourself or{" "}
                                  <span className="font-semibold">move</span>{" "}
                                  to another shift, please contact the co-ordinator —
                                  volunteers cannot remove their own sign-up.
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}
      </div>

      <Modal title="Sign up for shift" isOpen={isModalOpen} onClose={() => closeReserveModal()}>
        <div className="grid gap-3">
          <Input
            label="First name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="e.g. John"
            autoComplete="given-name"
          />
          <Input
            label="Last name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="e.g. Smith"
            autoComplete="family-name"
          />
          <div className="mt-2 flex items-center justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => closeReserveModal()} disabled={isBusy}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void reserve()} disabled={isBusy}>
              Save
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

