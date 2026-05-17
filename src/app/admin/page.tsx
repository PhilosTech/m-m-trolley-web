"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api/client";
import type { BookingPolicy, Id, Location, MapLocationDraft, Session, SlotWithBooking } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhotoUploader } from "@/components/ui/photo-uploader";
import { Tabs } from "@/components/ui/tabs";
import { timeToIsoOnEventDate } from "@/lib/config/event";
import { buildRowsWithPendingSlots, type PendingSlotDraft } from "@/lib/admin/pending-slots";
import { clearSession, loadSession, saveSession } from "@/lib/session/session";
import { ScheduleTable } from "@/components/schedule/schedule-table";
import { Modal } from "@/components/ui/modal";
import { Lightbox } from "@/components/ui/lightbox";

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

  const [activeTab, setActiveTab] = useState<"create" | "result" | "map">("create");
  const [locations, setLocations] = useState<Location[]>([]);
  const [expandedLocationId, setExpandedLocationId] = useState<Id | null>(null);
  const [bookingPolicy, setBookingPolicy] = useState<BookingPolicy | null>(null);
  const [mapDraftSrc, setMapDraftSrc] = useState<string | null>(null);
  const [mapPreviewSrc, setMapPreviewSrc] = useState<string | null>(null);
  const [mapLocations, setMapLocations] = useState<MapLocationDraft[]>([]);
  const [mapCreateDraft, setMapCreateDraft] = useState<{
    positionNumber: string;
    title: string;
    photoUrl: string | null;
  }>({ positionNumber: "", title: "", photoUrl: null });
  const [mapEditDraftById, setMapEditDraftById] = useState<
    Record<string, { positionNumber: string; title: string; photoUrl: string | null }>
  >({});
  const [mapLocationPreviewSrc, setMapLocationPreviewSrc] = useState<string | null>(null);

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

  const maxMapBannerFileBytes = 15 * 1024 * 1024;

  useEffect(() => {
    const t = window.setTimeout(() => {
      const s = loadSession();
      if (s?.role === "admin") {
        setSession(s);
        setState({ status: "loading" });
        void loadInitial(s);
      }
    }, 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!session) return;
    if (activeTab !== "result") return;
    const t = window.setInterval(() => {
      void loadInitial(session);
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

  async function loadInitial(currentSession: Session | null) {
    const locRes = await apiClient.listLocations();
    if (!locRes.ok) {
      setState({ status: "error", message: locRes.error.message });
      return;
    }
    if (currentSession?.role === "admin") {
      const policyRes = await apiClient.getBookingPolicy("admin");
      if (!policyRes.ok) {
        setState({ status: "error", message: policyRes.error.message });
        return;
      }
      setBookingPolicy(policyRes.data);
    }
    setLocations(locRes.data);
    if (currentSession?.role === "admin") {
      const mapRes = await apiClient.listMapLocations("admin");
      if (!mapRes.ok) {
        setState({ status: "error", message: mapRes.error.message });
        return;
      }
      setMapLocations(mapRes.data);
    }
    setExpandedLocationId((prev) => {
      if (prev && locRes.data.some((l) => l.id === prev)) return prev;
      return locRes.data[0]?.id ?? null;
    });
    setState({ status: "ready" });
  }

  async function applyMapBanner(nextSrc: string | null) {
    if (!session || session.role !== "admin") {
      setState({ status: "error", message: "Admin session required." });
      return;
    }
    setIsBusy(true);
    setPendingOp("map-apply");
    try {
      const next = (nextSrc ?? "").trim();
      const res = await apiClient.setMapPhoto("admin", { mapPhotoUrl: next.length ? next : null });
      if (!res.ok) {
        setFlash({ type: "error", message: res.error.message });
        return;
      }
      setBookingPolicy(res.data);
      setMapDraftSrc(null);
      setFlash({ type: "success", message: "Map banner saved." });
    } finally {
      setIsBusy(false);
      setPendingOp(null);
    }
  }

  async function deleteMapBanner() {
    setMapDraftSrc(null);
    await applyMapBanner(null);
  }

  async function mapCreateLocation() {
    if (!session || session.role !== "admin") {
      setState({ status: "error", message: "Admin session required." });
      return;
    }
    setIsBusy(true);
    setPendingOp("map-create-location");
    try {
      const pos = Number.parseInt(mapCreateDraft.positionNumber, 10);
      if (!Number.isFinite(pos) || pos <= 0) {
        setFlash({ type: "error", message: "Enter a valid position number (1+)." });
        return;
      }
      if (mapCreateDraft.title.trim().length === 0) {
        setFlash({ type: "error", message: "Enter a location name." });
        return;
      }
      const res = await apiClient.createMapLocation("admin", {
        positionNumber: pos,
        title: mapCreateDraft.title.trim(),
        photoUrl: mapCreateDraft.photoUrl,
      });
      if (!res.ok) {
        setFlash({ type: "error", message: res.error.message });
        return;
      }
      await loadInitial(session);
      setMapCreateDraft({ positionNumber: "", title: "", photoUrl: null });
      setFlash({ type: "success", message: "Location created. Fill in details and apply." });
    } finally {
      setIsBusy(false);
      setPendingOp(null);
    }
  }

  async function mapApplyLocation(id: Id) {
    if (!session || session.role !== "admin") {
      setState({ status: "error", message: "Admin session required." });
      return;
    }
    const serverRow = mapLocations.find((x) => x.id === id);
    if (!serverRow) return;
    const draft = mapEditDraftById[id] ?? {
      positionNumber: String(serverRow.positionNumber),
      title: serverRow.title,
      photoUrl: serverRow.photoUrl ?? null,
    };
    const pos = Number.parseInt(draft.positionNumber, 10);
    if (!Number.isFinite(pos) || pos <= 0) {
      setFlash({ type: "error", message: "Enter a valid position number (1+)." });
      return;
    }
    if (draft.title.trim().length === 0) {
      setFlash({ type: "error", message: "Enter a location name." });
      return;
    }
    setIsBusy(true);
    setPendingOp(`map-apply-location:${id}`);
    try {
      const res = await apiClient.updateMapLocation("admin", {
        id,
        positionNumber: pos,
        title: draft.title.trim(),
        photoUrl: draft.photoUrl,
      });
      if (!res.ok) {
        setFlash({ type: "error", message: res.error.message });
        return;
      }
      await loadInitial(session);
      setMapEditDraftById((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setFlash({ type: "success", message: "Location saved." });
    } finally {
      setIsBusy(false);
      setPendingOp(null);
    }
  }

  async function mapDeleteLocation(id: Id) {
    if (!session || session.role !== "admin") {
      setState({ status: "error", message: "Admin session required." });
      return;
    }
    setIsBusy(true);
    setPendingOp(`map-delete-location:${id}`);
    try {
      const res = await apiClient.deleteMapLocation("admin", { id });
      if (!res.ok) {
        setFlash({ type: "error", message: res.error.message });
        return;
      }
      await loadInitial(session);
      setMapEditDraftById((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setFlash({ type: "success", message: "Location deleted." });
    } finally {
      setIsBusy(false);
      setPendingOp(null);
    }
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
          ? "Volunteer sign-up is now closed for everyone."
          : "Volunteer sign-up is open again for everyone.",
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
        message: nextLocked
          ? "Volunteer sign-up is closed for this location."
          : "Volunteer sign-up is open for this location.",
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
      await loadInitial(res.data);
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
      await loadInitial(session);
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
      await loadInitial(session);
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
      await loadInitial(session);
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
      await loadInitial(session);
      setState({ status: "ready" });
      setFlash({
        type: "success",
        message:
          nextStatus === "published"
            ? "Published. Volunteers can see this location."
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
      await loadInitial(session);
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
      await loadInitial(session);
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
      setFlash({ type: "success", message: "Volunteer added." });
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
      setFlash({ type: "success", message: "Volunteer removed." });
      closeDeleteBooking();
    } finally {
      setIsBusy(false);
      setPendingOp(null);
    }
  }

  return (
    <div className="min-h-full overflow-x-clip bg-zinc-50 px-4 py-12 text-zinc-950 sm:px-8">
      <div className="mx-auto flex min-h-[calc(100dvh-2.5rem)] w-full min-w-0 max-w-[min(100%,92rem)] flex-col gap-5">
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
              Manage trolley locations, shifts, and volunteer sign-ups.
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
                    { id: "map", label: "Proposed locations" },
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
                  {bookingPolicy.isGlobalLocked ? "Open sign-up" : "Close sign-up"}
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
              ) : activeTab === "map" ? (
                <div className="grid gap-4">
                  <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-4 py-4 sm:px-5">
                      <div className="min-w-0">
                        <div className="text-base font-semibold text-zinc-900">Map banner</div>
                        <div className="mt-1 text-xs text-zinc-600">
                          Upload one image, click it to view full screen.
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                            <label
                          className={[
                                "inline-flex cursor-pointer items-center justify-center rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-500",
                                "focus-within:outline-none focus-within:ring-2 focus-within:ring-blue-600 focus-within:ring-offset-2 focus-within:ring-offset-white",
                                isBusy ? "cursor-not-allowed opacity-60 hover:bg-blue-600" : "",
                          ].join(" ")}
                        >
                          <input
                            type="file"
                            accept="image/*"
                            className="sr-only"
                            disabled={isBusy}
                            aria-label="Upload map banner"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) {
                                if (e.target) e.target.value = "";
                                return;
                              }
                              if (file.size > maxMapBannerFileBytes) {
                                const maxMb = Math.round(maxMapBannerFileBytes / (1024 * 1024));
                                setFlash({
                                  type: "error",
                                  message: `File is too large (max ${maxMb} MB). Try a smaller image.`,
                                });
                                if (e.target) e.target.value = "";
                                return;
                              }
                              void (async () => {
                                try {
                                  const dataUrl = await fileToDataUrl(file);
                                  setMapDraftSrc(dataUrl);
                                  await applyMapBanner(dataUrl);
                                } catch (err: unknown) {
                                  setFlash({
                                    type: "error",
                                    message: err instanceof Error ? err.message : "Failed to read file.",
                                  });
                                }
                              })();
                              if (e.target) e.target.value = "";
                            }}
                          />
                          Upload
                        </label>
                        <Button
                          type="button"
                          variant="danger"
                          onClick={() => void deleteMapBanner()}
                          disabled={isBusy || !bookingPolicy || !(bookingPolicy.mapPhotoUrl ?? "").length}
                          isLoading={pendingOp === "map-apply"}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>

                    <div className="px-4 py-4 sm:px-5">
                      {(() => {
                        const src = (mapDraftSrc ?? bookingPolicy?.mapPhotoUrl ?? "").trim();
                        if (!src.length) {
                          return (
                            <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-6 text-sm text-zinc-700">
                              No map banner yet.
                            </div>
                          );
                        }
                        return (
                          <button
                            type="button"
                            className="group relative block w-full overflow-hidden rounded-xl border border-zinc-200 bg-white outline-none ring-zinc-900 focus-visible:ring-2"
                            onClick={() => setMapPreviewSrc(src)}
                            aria-label="Open map banner full screen"
                          >
                            <div className="relative h-80 w-full sm:h-112">
                              <img
                                src={src}
                                alt="Map banner"
                                className="absolute inset-0 h-full w-full object-cover"
                                loading="lazy"
                                decoding="async"
                              />
                            </div>
                            <div className="pointer-events-none absolute inset-0 bg-black/0 transition group-hover:bg-black/10" />
                          </button>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="grid gap-4">
                    <div className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5">
                      <div className="text-sm font-semibold text-zinc-900">Create map location</div>
                      <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                        The uploaded map has numbered squares. Find a square on the map, enter its number, add a
                        location name, attach a photo, then press <span className="font-semibold">Create</span>.
                      </div>
                      <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-center">
                        <div className="w-full md:w-40">
                          <Input
                            label="Position number"
                            value={mapCreateDraft.positionNumber}
                            disabled={isBusy}
                            onChange={(e) =>
                              setMapCreateDraft((p) => ({ ...p, positionNumber: e.target.value }))
                            }
                            placeholder="1"
                          />
                        </div>
                        <div className="w-full md:min-w-88 md:flex-1">
                          <Input
                            label="Location name"
                            value={mapCreateDraft.title}
                            disabled={isBusy}
                            onChange={(e) => setMapCreateDraft((p) => ({ ...p, title: e.target.value }))}
                            placeholder="Name"
                          />
                        </div>
                        <div className="w-full md:w-64">
                          <div className="grid gap-2">
                            <div className="text-sm font-medium text-zinc-900">Photo</div>
                            <div className="flex items-center gap-3">
                              {mapCreateDraft.photoUrl ? (
                                <button
                                  type="button"
                                  className="group relative h-16 w-24 overflow-hidden rounded-xl border border-zinc-200 bg-white outline-none ring-zinc-900 focus-visible:ring-2"
                                  onClick={() => setMapLocationPreviewSrc(mapCreateDraft.photoUrl)}
                                  aria-label="Open location photo full screen"
                                >
                                  <img
                                    src={mapCreateDraft.photoUrl}
                                    alt="Location photo"
                                    className="h-full w-full object-cover"
                                    loading="lazy"
                                    decoding="async"
                                  />
                                  <div className="pointer-events-none absolute inset-0 bg-black/0 transition group-hover:bg-black/10" />
                                </button>
                              ) : (
                                <div className="h-16 w-24 rounded-xl border border-dashed border-zinc-300 bg-zinc-50" />
                              )}
                              <div className="grid gap-2">
                            <label
                                  className={[
                                "inline-flex cursor-pointer items-center justify-center rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-500",
                                "focus-within:outline-none focus-within:ring-2 focus-within:ring-blue-600 focus-within:ring-offset-2 focus-within:ring-offset-white",
                                isBusy ? "cursor-not-allowed opacity-60 hover:bg-blue-600" : "",
                                  ].join(" ")}
                                >
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="sr-only"
                                    disabled={isBusy}
                                    aria-label="Upload location photo"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (!file) {
                                        if (e.target) e.target.value = "";
                                        return;
                                      }
                                      void (async () => {
                                        try {
                                          const dataUrl = await fileToDataUrl(file);
                                          setMapCreateDraft((p) => ({ ...p, photoUrl: dataUrl }));
                                        } catch (err: unknown) {
                                          setFlash({
                                            type: "error",
                                            message: err instanceof Error ? err.message : "Failed to read file.",
                                          });
                                        }
                                      })();
                                      if (e.target) e.target.value = "";
                                    }}
                                  />
                                  Upload
                                </label>
                                <Button
                                  type="button"
                                  variant="warning"
                                  onClick={() => setMapCreateDraft((p) => ({ ...p, photoUrl: null }))}
                                  disabled={isBusy || !mapCreateDraft.photoUrl}
                                >
                                  Clear
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="publish"
                          onClick={() => void mapCreateLocation()}
                          disabled={isBusy}
                          isLoading={pendingOp === "map-create-location"}
                        >
                          Create
                        </Button>
                      </div>
                    </div>

                    <div className="mt-6">
                      <div className="text-sm font-semibold text-zinc-900">Proposed locations list</div>
                      <div className="mt-1 text-xs text-zinc-600">
                        You can edit items in this list and press <span className="font-medium">Apply</span>, or{" "}
                        <span className="font-medium">Delete</span> locations you don’t need.
                      </div>
                    </div>

                    {mapLocations.map((row) => {
                      const draft = mapEditDraftById[row.id] ?? {
                        positionNumber: String(row.positionNumber),
                        title: row.title,
                        photoUrl: row.photoUrl ?? null,
                      };
                      const hasChanges =
                        draft.positionNumber !== String(row.positionNumber) ||
                        draft.title !== row.title ||
                        (draft.photoUrl ?? null) !== (row.photoUrl ?? null);
                      const isOp =
                        pendingOp === `map-apply-location:${row.id}` ||
                        pendingOp === `map-delete-location:${row.id}`;

                      return (
                        <div key={row.id} className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-zinc-900">
                                #{row.positionNumber} · {row.title.trim().length ? row.title : "Untitled"}
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-center">
                            <div className="w-full md:w-40">
                              <Input
                                label="Position number"
                                value={draft.positionNumber}
                                disabled={isBusy || isOp}
                                onChange={(e) =>
                                  setMapEditDraftById((prev) => ({
                                    ...prev,
                                    [row.id]: {
                                      positionNumber: e.target.value,
                                      title: draft.title,
                                      photoUrl: draft.photoUrl,
                                    },
                                  }))
                                }
                              />
                            </div>
                            <div className="w-full md:min-w-88 md:flex-1">
                              <Input
                                label="Location name"
                                value={draft.title}
                                disabled={isBusy || isOp}
                                onChange={(e) =>
                                  setMapEditDraftById((prev) => ({
                                    ...prev,
                                    [row.id]: {
                                      positionNumber: draft.positionNumber,
                                      title: e.target.value,
                                      photoUrl: draft.photoUrl,
                                    },
                                  }))
                                }
                              />
                            </div>
                            <div className="w-full md:w-64">
                              <div className="grid gap-2">
                                <div className="text-sm font-medium text-zinc-900">Photo</div>
                                <div className="flex items-center gap-3">
                                  {draft.photoUrl ? (
                                    <button
                                      type="button"
                                      className="group relative h-16 w-24 overflow-hidden rounded-xl border border-zinc-200 bg-white outline-none ring-zinc-900 focus-visible:ring-2"
                                      onClick={() => setMapLocationPreviewSrc(draft.photoUrl)}
                                      aria-label="Open location photo full screen"
                                    >
                                      <img
                                        src={draft.photoUrl}
                                        alt="Location photo"
                                        className="h-full w-full object-cover"
                                        loading="lazy"
                                        decoding="async"
                                      />
                                      <div className="pointer-events-none absolute inset-0 bg-black/0 transition group-hover:bg-black/10" />
                                    </button>
                                  ) : (
                                    <div className="h-16 w-24 rounded-xl border border-dashed border-zinc-300 bg-zinc-50" />
                                  )}

                                  <div className="grid gap-2">
                                    <label
                                      className={[
                                        "inline-flex cursor-pointer items-center justify-center rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-500",
                                        "focus-within:outline-none focus-within:ring-2 focus-within:ring-blue-600 focus-within:ring-offset-2 focus-within:ring-offset-white",
                                        isBusy ? "cursor-not-allowed opacity-60 hover:bg-blue-600" : "",
                                      ].join(" ")}
                                    >
                                      <input
                                        type="file"
                                        accept="image/*"
                                        className="sr-only"
                                        disabled={isBusy}
                                        aria-label="Upload location photo"
                                        onChange={(e) => {
                                          const file = e.target.files?.[0];
                                          if (!file) {
                                            if (e.target) e.target.value = "";
                                            return;
                                          }
                                          void (async () => {
                                            try {
                                              const dataUrl = await fileToDataUrl(file);
                                              setMapEditDraftById((prev) => ({
                                                ...prev,
                                                [row.id]: {
                                                  positionNumber: draft.positionNumber,
                                                  title: draft.title,
                                                  photoUrl: dataUrl,
                                                },
                                              }));
                                            } catch (err: unknown) {
                                              setFlash({
                                                type: "error",
                                                message: err instanceof Error ? err.message : "Failed to read file.",
                                              });
                                            }
                                          })();
                                          if (e.target) e.target.value = "";
                                        }}
                                      />
                                      Upload
                                    </label>
                                    <Button
                                      type="button"
                                      variant="warning"
                                      onClick={() =>
                                        setMapEditDraftById((prev) => ({
                                          ...prev,
                                          [row.id]: {
                                            positionNumber: draft.positionNumber,
                                            title: draft.title,
                                            photoUrl: null,
                                          },
                                        }))
                                      }
                                      disabled={isBusy || !draft.photoUrl}
                                    >
                                      Clear
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                            <Button
                              type="button"
                              variant={hasChanges ? "unpublish" : "warning"}
                              onClick={() => void mapApplyLocation(row.id)}
                              disabled={isBusy || !hasChanges}
                              isLoading={pendingOp === `map-apply-location:${row.id}`}
                            >
                              Apply
                            </Button>
                            <Button
                              type="button"
                              variant="danger"
                              onClick={() => void mapDeleteLocation(row.id)}
                              disabled={isBusy}
                              isLoading={pendingOp === `map-delete-location:${row.id}`}
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
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
                          className="flex w-full items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-100 px-4 py-4 text-left transition hover:bg-zinc-200/80 sm:gap-4 sm:px-5"
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
                                      ? "Open sign-up for this location"
                                      : "Close sign-up for this location"}
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

      <Lightbox
        src={mapPreviewSrc ?? ""}
        alt="Map banner"
        isOpen={mapPreviewSrc !== null}
        onClose={() => setMapPreviewSrc(null)}
      />

      <Lightbox
        src={mapLocationPreviewSrc ?? ""}
        alt="Location photo"
        isOpen={mapLocationPreviewSrc !== null}
        onClose={() => setMapLocationPreviewSrc(null)}
      />

      <Modal
        title="Add volunteer"
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
        title="Remove volunteer?"
        isOpen={deleteBookingId !== null}
        onClose={() => closeDeleteBooking()}
      >
        <div className="grid gap-3 text-sm text-zinc-700">
          <div>This will remove the volunteer from the shift.</div>
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

