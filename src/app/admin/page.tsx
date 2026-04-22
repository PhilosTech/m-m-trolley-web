"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api/client";
import type { BookingPolicy, Id, Location, Session, SlotWithBooking } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhotoUploader } from "@/components/ui/photo-uploader";
import { Tabs } from "@/components/ui/tabs";
import { timeToIsoOnEventDate } from "@/lib/config/event";
import { buildRowsWithPendingSlots, type PendingSlotDraft } from "@/lib/admin/pending-slots";
import { clearSession, loadSession, saveSession } from "@/lib/session/session";
import { ScheduleTable } from "@/components/schedule/schedule-table";
import { Modal } from "@/components/ui/modal";

type ViewState =
  | { status: "auth" }
  | { status: "loading" }
  | { status: "ready" }
  | { status: "error"; message: string };

type FlashState = { type: "success" | "error"; message: string } | null;

export default function AdminPage() {
  const [accessCode, setAccessCode] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [state, setState] = useState<ViewState>({ status: "auth" });
  const [isBusy, setIsBusy] = useState(false);
  const [pendingOp, setPendingOp] = useState<string | null>(null);
  const [flash, setFlash] = useState<FlashState>(null);

  const [activeTab, setActiveTab] = useState<"create" | "result">("create");
  const [locations, setLocations] = useState<Location[]>([]);
  const [expandedLocationId, setExpandedLocationId] = useState<Id | null>(null);
  const [bookingPolicy, setBookingPolicy] = useState<BookingPolicy | null>(null);

  const [scheduleByLocationId, setScheduleByLocationId] = useState<
    Record<string, SlotWithBooking[]>
  >({});

  const [draftByLocationId, setDraftByLocationId] = useState<
    Record<string, { title: string; googleMapsUrl: string }>
  >({});

  const [slotDraftByLocationId, setSlotDraftByLocationId] = useState<
    Record<string, { startTimeHHMM: string; endTimeHHMM: string }>
  >({});

  const [pendingSlotsByLocationId, setPendingSlotsByLocationId] = useState<
    Record<string, PendingSlotDraft[]>
  >({});

  const [addParticipantSlotId, setAddParticipantSlotId] = useState<Id | null>(null);
  const [addFirstName, setAddFirstName] = useState("");
  const [addLastName, setAddLastName] = useState("");

  const [deleteBookingId, setDeleteBookingId] = useState<Id | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      const s = loadSession();
      if (s?.role === "admin") {
        setSession(s);
        setState({ status: "loading" });
        void loadInitial();
      }
    }, 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!session) return;
    if (activeTab !== "result") return;
    const t = window.setInterval(() => {
      void loadInitial();
      for (const loc of locations) void refreshSchedule(loc.id);
    }, 2500);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, locations, session]);

  useEffect(() => {
    if (!flash) return;
    const t = window.setTimeout(() => setFlash(null), 4500);
    return () => window.clearTimeout(t);
  }, [flash]);

  // Load schedule when a place is expanded — listLocations does not include slots.
  useEffect(() => {
    if (state.status !== "ready" || !session) return;
    if (!expandedLocationId) return;
    if (scheduleByLocationId[expandedLocationId] !== undefined) return;
    void refreshSchedule(expandedLocationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status, session, expandedLocationId, locations]);

  async function loadInitial() {
    const locRes = await apiClient.listLocations();
    if (!locRes.ok) {
      setState({ status: "error", message: locRes.error.message });
      return;
    }
    if (session?.role === "admin") {
      const policyRes = await apiClient.getBookingPolicy("admin");
      if (!policyRes.ok) {
        setState({ status: "error", message: policyRes.error.message });
        return;
      }
      setBookingPolicy(policyRes.data);
    }
    setLocations(locRes.data);
    setExpandedLocationId((prev) => {
      if (prev && locRes.data.some((l) => l.id === prev)) return prev;
      return locRes.data[0]?.id ?? null;
    });
    setState({ status: "ready" });
  }

  async function setGlobalLock(nextLocked: boolean) {
    if (!session || session.role !== "admin") {
      setState({ status: "error", message: "Admin session required." });
      return;
    }
    setIsBusy(true);
    setPendingOp("global-lock");
    try {
      const res = await apiClient.setGlobalBookingLock("admin", { isLocked: nextLocked });
      if (!res.ok) {
        setFlash({ type: "error", message: res.error.message });
        return;
      }
      setBookingPolicy(res.data);
      setFlash({
        type: "success",
        message: nextLocked
          ? "Adding participants is now closed for everyone."
          : "Adding participants is open again for everyone.",
      });
    } finally {
      setIsBusy(false);
      setPendingOp(null);
    }
  }

  async function setLocationLock(locationId: Id, nextLocked: boolean) {
    if (!session || session.role !== "admin") {
      setState({ status: "error", message: "Admin session required." });
      return;
    }
    setIsBusy(true);
    setPendingOp(`location-lock:${locationId}`);
    try {
      const res = await apiClient.setLocationBookingLock("admin", { locationId, isLocked: nextLocked });
      if (!res.ok) {
        setFlash({ type: "error", message: res.error.message });
        return;
      }
      setBookingPolicy(res.data);
      setFlash({
        type: "success",
        message: nextLocked ? "Adding is closed for this place." : "Adding is open for this place.",
      });
    } finally {
      setIsBusy(false);
      setPendingOp(null);
    }
  }

  async function login() {
    setIsBusy(true);
    setPendingOp("login");
    setState({ status: "loading" });
    try {
      const res = await apiClient.login("admin", accessCode);
      if (!res.ok) {
        setState({ status: "auth" });
        setFlash({ type: "error", message: res.error.message });
        return;
      }
      saveSession(res.data);
      setSession(res.data);
      await loadInitial();
      setFlash({ type: "success", message: "Signed in as admin." });
    } finally {
      setIsBusy(false);
      setPendingOp(null);
    }
  }

  async function logout() {
    clearSession();
    setSession(null);
    setAccessCode("");
    setLocations([]);
    setExpandedLocationId(null);
    setScheduleByLocationId({});
    setPendingSlotsByLocationId({});
    setState({ status: "auth" });
    setFlash(null);
  }

  async function refreshSchedule(locationId: Id) {
    const sched = await apiClient.getSchedule(locationId);
    if (!sched.ok) {
      setState({ status: "error", message: sched.error.message });
      return;
    }
    setScheduleByLocationId((prev) => ({ ...prev, [locationId]: sched.data }));
  }

  async function toggleExpanded(locationId: Id) {
    setExpandedLocationId(locationId);
    await refreshSchedule(locationId);
  }

  async function createLocation() {
    if (!session || session.role !== "admin") {
      setState({ status: "error", message: "Admin session required." });
      return;
    }
    setIsBusy(true);
    setPendingOp("create-place");
    try {
      const res = await apiClient.createLocation("admin", { title: "", photoUrls: [] });
      if (!res.ok) {
        setFlash({ type: "error", message: res.error.message });
        return;
      }
      await loadInitial();
      const newId = res.data.id;
      setExpandedLocationId(newId);
      await refreshSchedule(newId);
      setFlash({ type: "success", message: "New place created. Fill in details and save." });
    } finally {
      setIsBusy(false);
      setPendingOp(null);
    }
  }

  async function savePlace(locationId: Id) {
    if (!session || session.role !== "admin") {
      setState({ status: "error", message: "Admin session required." });
      return;
    }
    const locRow = locations.find((l) => l.id === locationId);
    const draft =
      draftByLocationId[locationId] ??
      (locRow
        ? { title: locRow.title, googleMapsUrl: locRow.googleMapsUrl ?? "" }
        : undefined);
    if (!draft) return;
    const queue = [...(pendingSlotsByLocationId[locationId] ?? [])];
    setIsBusy(true);
    setPendingOp(`save:${locationId}`);
    try {
      for (let i = 0; i < queue.length; i++) {
        const p = queue[i]!;
        const res = await apiClient.createSlot("admin", {
          locationId,
          startTimeIso: timeToIsoOnEventDate(p.startTimeHHMM),
          endTimeIso: timeToIsoOnEventDate(p.endTimeHHMM),
          capacity: 50,
        });
        if (!res.ok) {
          await refreshSchedule(locationId);
          setPendingSlotsByLocationId((prev) => ({
            ...prev,
            [locationId]: queue.slice(i),
          }));
          setFlash({ type: "error", message: res.error.message });
          return;
        }
      }
      if (queue.length > 0) {
        setPendingSlotsByLocationId((prev) => ({ ...prev, [locationId]: [] }));
      }
      const res = await apiClient.updateLocation("admin", {
        locationId,
        title: draft.title,
        googleMapsUrl: draft.googleMapsUrl,
      });
      if (!res.ok) {
        await refreshSchedule(locationId);
        setFlash({ type: "error", message: res.error.message });
        return;
      }
      await loadInitial();
      await refreshSchedule(locationId);
      setState({ status: "ready" });
      const n = queue.length;
      setFlash({
        type: "success",
        message:
          n > 0
            ? `Saved place and ${n} new time slot${n === 1 ? "" : "s"}.`
            : "Place saved.",
      });
    } finally {
      setIsBusy(false);
      setPendingOp(null);
    }
  }

  function queueSlotDraft(locationId: Id) {
    const d = slotDraftByLocationId[locationId];
    if (!d?.startTimeHHMM || !d?.endTimeHHMM) {
      setFlash({ type: "error", message: "Enter start and end time." });
      return;
    }
    const clientId = `pend_${crypto.randomUUID()}`;
    setPendingSlotsByLocationId((prev) => ({
      ...prev,
      [locationId]: [...(prev[locationId] ?? []), { clientId, startTimeHHMM: d.startTimeHHMM, endTimeHHMM: d.endTimeHHMM }],
    }));
    setSlotDraftByLocationId((prev) => ({
      ...prev,
      [locationId]: { startTimeHHMM: "", endTimeHHMM: "" },
    }));
  }

  function removePendingOrServerSlot(locationId: Id, slotId: Id) {
    if (slotId.startsWith("pend_")) {
      setPendingSlotsByLocationId((prev) => ({
        ...prev,
        [locationId]: (prev[locationId] ?? []).filter((p) => p.clientId !== slotId),
      }));
      return;
    }
    void deleteSlot(locationId, slotId);
  }

  async function deleteLocation(locationId: Id) {
    if (!session || session.role !== "admin") {
      setState({ status: "error", message: "Admin session required." });
      return;
    }
    setIsBusy(true);
    setPendingOp(`delete:${locationId}`);
    try {
      const res = await apiClient.deleteLocation("admin", locationId);
      if (!res.ok) {
        setFlash({ type: "error", message: res.error.message });
        return;
      }
      await loadInitial();
      setState({ status: "ready" });
      setPendingSlotsByLocationId((prev) => {
        const next = { ...prev };
        delete next[locationId];
        return next;
      });
      setFlash({ type: "success", message: "Place deleted." });
    } finally {
      setIsBusy(false);
      setPendingOp(null);
    }
  }

  async function setPublish(locationId: Id, nextStatus: "draft" | "published") {
    if (!session || session.role !== "admin") {
      setState({ status: "error", message: "Admin session required." });
      return;
    }
    if (nextStatus === "published" && (pendingSlotsByLocationId[locationId]?.length ?? 0) > 0) {
      setFlash({
        type: "error",
        message: "You have time slots not saved yet. Press Save first, then Publish.",
      });
      return;
    }
    const opKey = nextStatus === "published" ? `publish:${locationId}` : `unpublish:${locationId}`;
    setIsBusy(true);
    setPendingOp(opKey);
    try {
      const res = await apiClient.updateLocation("admin", { locationId, status: nextStatus });
      if (!res.ok) {
        setFlash({ type: "error", message: res.error.message });
        return;
      }
      await loadInitial();
      setState({ status: "ready" });
      setFlash({
        type: "success",
        message:
          nextStatus === "published"
            ? "Published. Participants can see this place."
            : "Unpublished. Place is draft again — you can edit it.",
      });
    } finally {
      setIsBusy(false);
      setPendingOp(null);
    }
  }

  async function addPhoto(locationId: Id, file: File) {
    if (!session || session.role !== "admin") {
      setState({ status: "error", message: "Admin session required." });
      return;
    }
    const location = locations.find((l) => l.id === locationId);
    if (!location) return;
    setIsBusy(true);
    setPendingOp(`photo:${locationId}`);
    try {
      const dataUrl = await fileToDataUrl(file);
      const nextPhotoUrls = [...location.photoUrls, dataUrl];
      const res = await apiClient.updateLocation("admin", { locationId, photoUrls: nextPhotoUrls });
      if (!res.ok) {
        setFlash({ type: "error", message: res.error.message });
        return;
      }
      await loadInitial();
      setState({ status: "ready" });
      setFlash({ type: "success", message: "Photo saved." });
    } finally {
      setIsBusy(false);
      setPendingOp(null);
    }
  }

  function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Failed to read file."));
      reader.onload = () => {
        if (typeof reader.result === "string") resolve(reader.result);
        else reject(new Error("Failed to read file."));
      };
      reader.readAsDataURL(file);
    });
  }

  async function removePhoto(locationId: Id, url: string) {
    if (!session || session.role !== "admin") {
      setState({ status: "error", message: "Admin session required." });
      return;
    }
    const location = locations.find((l) => l.id === locationId);
    if (!location) return;
    setIsBusy(true);
    setPendingOp(`photo:${locationId}`);
    try {
      const nextPhotoUrls = location.photoUrls.filter((p) => p !== url);
      const res = await apiClient.updateLocation("admin", { locationId, photoUrls: nextPhotoUrls });
      if (!res.ok) {
        setFlash({ type: "error", message: res.error.message });
        return;
      }
      await loadInitial();
      setState({ status: "ready" });
      setFlash({ type: "success", message: "Photo removed." });
    } finally {
      setIsBusy(false);
      setPendingOp(null);
    }
  }

  async function clearSlot(locationId: Id, timeSlotId: Id) {
    if (!session || session.role !== "admin") {
      setState({ status: "error", message: "Admin session required." });
      return;
    }
    if (timeSlotId.startsWith("pend_")) return;
    const res = await apiClient.clearSlot("admin", timeSlotId);
    if (!res.ok) {
      setState({ status: "error", message: res.error.message });
      return;
    }
    await refreshSchedule(locationId);
  }

  async function deleteSlot(locationId: Id, timeSlotId: Id) {
    if (!session || session.role !== "admin") {
      setState({ status: "error", message: "Admin session required." });
      return;
    }
    if (timeSlotId.startsWith("pend_")) return;
    const res = await apiClient.deleteSlot("admin", { timeSlotId });
    if (!res.ok) {
      setState({ status: "error", message: res.error.message });
      return;
    }
    await refreshSchedule(locationId);
  }

  function openAddParticipant(timeSlotId: Id) {
    setAddParticipantSlotId(timeSlotId);
    setAddFirstName("");
    setAddLastName("");
  }

  function closeAddParticipant() {
    setAddParticipantSlotId(null);
  }

  async function confirmAddParticipant() {
    if (!session || session.role !== "admin") {
      setState({ status: "error", message: "Admin session required." });
      return;
    }
    if (!addParticipantSlotId) return;
    const fullName = `${addFirstName} ${addLastName}`.trim().replaceAll(/\s+/g, " ");
    if (fullName.length < 2) {
      setState({ status: "error", message: "Please enter first and last name." });
      return;
    }
    setIsBusy(true);
    setPendingOp("add-participant");
    try {
      const res = await apiClient.adminAddParticipant("admin", {
        timeSlotId: addParticipantSlotId,
        participantName: fullName,
        seats: 1,
      });
      if (!res.ok) {
        setFlash({ type: "error", message: res.error.message });
        return;
      }
      for (const loc of locations) {
        if (!scheduleByLocationId[loc.id]) continue;
        await refreshSchedule(loc.id);
      }
      setFlash({ type: "success", message: "Participant added." });
      closeAddParticipant();
    } finally {
      setIsBusy(false);
      setPendingOp(null);
    }
  }

  function openDeleteBooking(bookingId: Id) {
    setDeleteBookingId(bookingId);
  }

  function closeDeleteBooking() {
    setDeleteBookingId(null);
  }

  async function confirmDeleteBooking() {
    if (!session || session.role !== "admin") {
      setState({ status: "error", message: "Admin session required." });
      return;
    }
    if (!deleteBookingId) return;
    setIsBusy(true);
    setPendingOp("delete-booking");
    try {
      const res = await apiClient.deleteBooking("admin", { bookingId: deleteBookingId });
      if (!res.ok) {
        setFlash({ type: "error", message: res.error.message });
        return;
      }
      for (const loc of locations) {
        if (!scheduleByLocationId[loc.id]) continue;
        await refreshSchedule(loc.id);
      }
      setFlash({ type: "success", message: "Participant removed." });
      closeDeleteBooking();
    } finally {
      setIsBusy(false);
      setPendingOp(null);
    }
  }

  return (
    <div className="min-h-full bg-zinc-50 px-4 py-12 text-zinc-950 sm:px-8">
      <div className="mx-auto flex min-h-[calc(100dvh-2.5rem)] w-full max-w-[min(100%,92rem)] flex-col gap-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-sm text-zinc-600">
              <Link href="/" className="underline">
                Home
              </Link>{" "}
              / Admin
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Admin</h1>
            <p className="mt-1 text-sm text-zinc-600">
              Create places and manage time slots.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {session?.role === "admin" ? (
              <Button type="button" variant="secondary" onClick={() => void logout()}>
                Log out
              </Button>
            ) : null}
          </div>
        </div>

        {flash ? (
          <div
            role="status"
            className={[
              "rounded-xl border px-4 py-3 text-sm",
              flash.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-red-200 bg-red-50 text-red-900",
            ].join(" ")}
          >
            {flash.message}
          </div>
        ) : null}

        {state.status === "auth" ? (
          <div className="mt-6 grid gap-4 rounded-2xl border border-zinc-200 bg-white p-6">
            <Input
              label="Admin access code"
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value)}
              placeholder="Enter code"
              autoComplete="off"
            />
            <div className="flex items-center gap-3">
              <Button
                type="button"
                onClick={() => void login()}
                disabled={isBusy}
                isLoading={pendingOp === "login"}
              >
                Continue
              </Button>
            </div>
          </div>
        ) : null}

        {state.status !== "auth" ? (
          <div className="mt-6 grid gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Tabs
                tabs={[
                  { id: "create", label: "Create" },
                  { id: "result", label: "View result" },
                ]}
                activeId={activeTab}
                onChange={setActiveTab}
              />
              {activeTab === "result" && bookingPolicy ? (
                <Button
                  type="button"
                  variant={bookingPolicy.isGlobalLocked ? "publish" : "danger"}
                  onClick={() => void setGlobalLock(!bookingPolicy.isGlobalLocked)}
                  disabled={isBusy}
                  isLoading={pendingOp === "global-lock"}
                >
                  {bookingPolicy.isGlobalLocked ? "Open adding" : "Stop adding"}
                </Button>
              ) : null}
              {activeTab === "create" ? (
                <Button
                  type="button"
                  variant="publish"
                  onClick={() => void createLocation()}
                  disabled={isBusy}
                  isLoading={pendingOp === "create-place"}
                >
                  Create place
                </Button>
              ) : null}
            </div>

            <div className="grid min-h-[min(70vh,36rem)] gap-4 rounded-2xl border border-zinc-200 bg-white p-6 sm:p-8">
              {state.status === "error" ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  {state.message}
                </div>
              ) : null}

              {state.status === "loading" ? (
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
                  Loading…
                </div>
              ) : (activeTab === "result"
                  ? locations.filter((l) => l.status === "published")
                  : locations
                ).length === 0 ? (
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
                  {activeTab === "result" ? (
                    <>No published places yet.</>
                  ) : (
                    <>
                      No places yet. Click <span className="font-medium">Create place</span>.
                    </>
                  )}
                </div>
              ) : (
                <div className="grid gap-4">
                  {(activeTab === "result"
                    ? locations.filter((l) => l.status === "published")
                    : locations
                  ).map((loc) => {
                    const isExpanded = expandedLocationId === loc.id;
                    const isEditableInCreateTab =
                      activeTab === "create" && loc.status !== "published";
                    const serverSchedule = scheduleByLocationId[loc.id] ?? [];
                    const pendingList = isEditableInCreateTab ? pendingSlotsByLocationId[loc.id] : undefined;
                    const schedule = isEditableInCreateTab
                      ? buildRowsWithPendingSlots(loc.id, serverSchedule, pendingList)
                      : serverSchedule;
                    const draftSlotIdSet = new Set(
                      (isEditableInCreateTab ? pendingSlotsByLocationId[loc.id] : undefined)?.map(
                        (p) => p.clientId,
                      ) ?? [],
                    );
                    const isLocationLocked =
                      !!bookingPolicy?.isGlobalLocked ||
                      !!bookingPolicy?.lockedLocationIds.includes(loc.id);
                    const draft = draftByLocationId[loc.id] ?? {
                      title: loc.title,
                      googleMapsUrl: loc.googleMapsUrl ?? "",
                    };
                    const slotDraft = slotDraftByLocationId[loc.id] ?? {
                      startTimeHHMM: "",
                      endTimeHHMM: "",
                    };

                    return (
                      <div
                        key={loc.id}
                        className="overflow-hidden rounded-2xl border border-zinc-200 bg-white"
                      >
                        <button
                          type="button"
                          className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left hover:bg-zinc-50 sm:gap-4 sm:px-5"
                          onClick={() => void toggleExpanded(loc.id)}
                          aria-label="Toggle place"
                        >
                          <div className="min-w-0">
                            <div className="text-base font-semibold text-zinc-900 line-clamp-2 sm:line-clamp-1">
                              {loc.title?.trim().length ? loc.title : "Untitled location"}
                            </div>
                            <div className="mt-1 text-xs text-zinc-600">
                              Status:{" "}
                              <span
                                className={[
                                  "inline-flex items-center rounded-full border px-2 py-0.5",
                                  loc.status === "published"
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                    : "border-zinc-200 bg-zinc-50 text-zinc-700",
                                ].join(" ")}
                              >
                                {loc.status === "published" ? "Published" : "Draft"}
                              </span>
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
                          <div className="border-t border-zinc-200 px-5 py-5">
                            {activeTab === "result" ? (
                              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                {bookingPolicy ? (
                                  <Button
                                    type="button"
                                    variant={isLocationLocked ? "publish" : "danger"}
                                    onClick={() => void setLocationLock(loc.id, !isLocationLocked)}
                                    disabled={isBusy}
                                    isLoading={pendingOp === `location-lock:${loc.id}`}
                                  >
                                    {isLocationLocked
                                      ? "Open adding for this place"
                                      : "Stop adding for this place"}
                                  </Button>
                                ) : (
                                  <div />
                                )}
                                <Button
                                  type="button"
                                  variant="secondary"
                                  onClick={() => void refreshSchedule(loc.id)}
                                  disabled={isBusy}
                                >
                                  Refresh
                                </Button>
                              </div>
                            ) : null}
                            {activeTab === "create" ? (
                              <>
                                {loc.status === "published" ? (
                                  <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                                    This place is <span className="font-semibold">Published</span>.
                                    Editing and deleting are disabled. Click{" "}
                                    <span className="font-semibold">Unpublish</span> to make changes.
                                  </div>
                                ) : (
                                  <div className="mb-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
                                    After you click <span className="font-semibold">Publish</span>,
                                    editing and deleting will be disabled. If you need to change or remove
                                    this place later, first click{" "}
                                    <span className="font-semibold">Unpublish</span>.
                                  </div>
                                )}
                                <div className="grid gap-3 md:grid-cols-2">
                                  <Input
                                    label="Place name"
                                    value={draft.title}
                                    disabled={!isEditableInCreateTab || isBusy}
                                    onChange={(e) =>
                                      setDraftByLocationId((prev) => ({
                                        ...prev,
                                        [loc.id]: {
                                          title: e.target.value,
                                          googleMapsUrl: draft.googleMapsUrl,
                                        },
                                      }))
                                    }
                                  />
                                  <Input
                                    label="Google Maps link"
                                    value={draft.googleMapsUrl}
                                    disabled={!isEditableInCreateTab || isBusy}
                                    onChange={(e) =>
                                      setDraftByLocationId((prev) => ({
                                        ...prev,
                                        [loc.id]: {
                                          title: draft.title,
                                          googleMapsUrl: e.target.value,
                                        },
                                      }))
                                    }
                                    placeholder="https://maps.google.com/?q=..."
                                  />
                                </div>

                                <div className="mt-4 grid gap-2">
                                  <PhotoUploader
                                    label="Photo"
                                    photoUrls={loc.photoUrls}
                                    onPickFile={(file) => void addPhoto(loc.id, file)}
                                    onRemoveUrl={(url) => void removePhoto(loc.id, url)}
                                    disabled={isBusy || !isEditableInCreateTab}
                                    maxPhotos={1}
                                  />
                                  <p className="text-xs text-zinc-600">
                                    The image is sent to the server when you pick a file.{" "}
                                    <span className="font-medium">Save</span> still updates the place name, map link,
                                    and any queued time slots.
                                  </p>
                                </div>

                                <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                                  <div className="text-sm font-semibold">Add time slot</div>
                                  <p className="mt-1 text-xs text-zinc-600">
                                    Choose start and end, click <span className="font-medium">Add to list</span>, then
                                    press <span className="font-medium">Save</span> at the bottom to store the place and
                                    all new slots on the server.
                                  </p>
                                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
                                    <label className="block min-w-0">
                                      <div className="text-sm font-medium text-zinc-900">Start</div>
                                      <input
                                        type="time"
                                        step={1800}
                                        className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
                                        value={slotDraft.startTimeHHMM}
                                        disabled={isBusy || !isEditableInCreateTab}
                                        onChange={(e) =>
                                          setSlotDraftByLocationId((prev) => ({
                                            ...prev,
                                            [loc.id]: {
                                              startTimeHHMM: e.target.value,
                                              endTimeHHMM: slotDraft.endTimeHHMM,
                                            },
                                          }))
                                        }
                                        aria-label="Start time"
                                      />
                                    </label>
                                    <label className="block min-w-0">
                                      <div className="text-sm font-medium text-zinc-900">End</div>
                                      <input
                                        type="time"
                                        step={1800}
                                        className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
                                        value={slotDraft.endTimeHHMM}
                                        disabled={isBusy || !isEditableInCreateTab}
                                        onChange={(e) =>
                                          setSlotDraftByLocationId((prev) => ({
                                            ...prev,
                                            [loc.id]: {
                                              startTimeHHMM: slotDraft.startTimeHHMM,
                                              endTimeHHMM: e.target.value,
                                            },
                                          }))
                                        }
                                        aria-label="End time"
                                      />
                                    </label>
                                    <div className="col-span-2 flex sm:col-span-1 sm:items-end">
                                      <Button
                                        type="button"
                                        className="w-full sm:w-auto"
                                        onClick={() => queueSlotDraft(loc.id)}
                                        disabled={isBusy || !isEditableInCreateTab}
                                      >
                                        Add to list
                                      </Button>
                                    </div>
                                  </div>
                                </div>

                              </>
                            ) : null}

                            <div className={activeTab === "create" ? "mt-6" : ""}>
                              <ScheduleTable
                                rows={schedule}
                                mode="admin"
                                isBusy={isBusy}
                                showParticipants={activeTab === "result"}
                                showActions
                                adminAction={activeTab === "result" ? "participants" : "slot"}
                                draftSlotIds={draftSlotIdSet}
                                onClear={
                                  activeTab === "result"
                                    ? (slotId) => void clearSlot(loc.id, slotId)
                                    : undefined
                                }
                                onDeleteSlot={
                                  activeTab === "create" && isEditableInCreateTab
                                    ? (slotId) => removePendingOrServerSlot(loc.id, slotId)
                                    : undefined
                                }
                                onAdminAddParticipant={
                                  activeTab === "result"
                                    ? (slotId) => openAddParticipant(slotId)
                                    : undefined
                                }
                                onAdminDeleteBooking={
                                  activeTab === "result" ? (bookingId) => openDeleteBooking(bookingId) : undefined
                                }
                              />
                            </div>

                            {activeTab === "create" ? (
                              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                                <Button
                                  type="button"
                                  variant="danger"
                                  onClick={() => void deleteLocation(loc.id)}
                                  disabled={isBusy || !isEditableInCreateTab}
                                  isLoading={pendingOp === `delete:${loc.id}`}
                                >
                                  Delete place
                                </Button>

                                <div className="flex flex-wrap items-center gap-3">
                                  {loc.status === "published" ? (
                                    <Button
                                      type="button"
                                      variant="unpublish"
                                      onClick={() => void setPublish(loc.id, "draft")}
                                      disabled={isBusy}
                                      isLoading={pendingOp === `unpublish:${loc.id}`}
                                    >
                                      Unpublish
                                    </Button>
                                  ) : (
                                    <Button
                                      type="button"
                                      variant="publish"
                                      onClick={() => void setPublish(loc.id, "published")}
                                      disabled={isBusy}
                                      isLoading={pendingOp === `publish:${loc.id}`}
                                    >
                                      Publish
                                    </Button>
                                  )}
                                  <Button
                                    type="button"
                                    onClick={() => void savePlace(loc.id)}
                                    disabled={isBusy || !isEditableInCreateTab}
                                    isLoading={pendingOp === `save:${loc.id}`}
                                  >
                                    Save
                                  </Button>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>

      <Modal
        title="Add participant"
        isOpen={addParticipantSlotId !== null}
        onClose={() => closeAddParticipant()}
      >
        <div className="grid gap-3">
          <Input
            label="First name"
            value={addFirstName}
            onChange={(e) => setAddFirstName(e.target.value)}
            placeholder="e.g. John"
            autoComplete="given-name"
          />
          <Input
            label="Last name"
            value={addLastName}
            onChange={(e) => setAddLastName(e.target.value)}
            placeholder="e.g. Smith"
            autoComplete="family-name"
          />
          <div className="mt-2 flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => closeAddParticipant()}
              disabled={isBusy}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void confirmAddParticipant()}
              disabled={isBusy}
              isLoading={pendingOp === "add-participant"}
            >
              Save
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        title="Remove participant?"
        isOpen={deleteBookingId !== null}
        onClose={() => closeDeleteBooking()}
      >
        <div className="grid gap-3 text-sm text-zinc-700">
          <div>This will remove the participant from the time slot.</div>
          <div className="mt-2 flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => closeDeleteBooking()}
              disabled={isBusy}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={() => void confirmDeleteBooking()}
              disabled={isBusy}
              isLoading={pendingOp === "delete-booking"}
            >
              Remove
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

