import { loadSession } from "@/lib/session/session";
import type {
  AdminAddParticipantInput,
  ApiResult,
  BookingPolicy,
  Booking,
  CreateLocationInput,
  CreateSlotInput,
  DeleteBookingInput,
  DeleteSlotInput,
  Id,
  Location,
  MapLocationDraft,
  ReserveInput,
  Role,
  Session,
  SetGlobalBookingLockInput,
  SetLocationBookingLockInput,
  SlotWithBooking,
  TimeSlot,
  UpdateLocationInput,
} from "./types";
import { API_BASE_URL } from "./config";

function ok<T>(data: T): ApiResult<T> {
  return { ok: true, data };
}

function err(message: string): ApiResult<never> {
  return {
    ok: false,
    error: { code: "INTERNAL_ERROR", message },
  };
}

async function parseErrorMessage(res: Response): Promise<string> {
  if (res.status === 413) {
    return "Request body is too large. Try a smaller image (fewer megabytes).";
  }
  try {
    const text = await res.text();
    if (!text) return res.statusText || `Request failed (${res.status})`;
    const j: unknown = JSON.parse(text);
    if (typeof j === "object" && j !== null && "message" in j) {
      const m = (j as { message: unknown }).message;
      if (typeof m === "string") return m;
      if (Array.isArray(m)) return m.filter((x) => typeof x === "string").join(", ");
    }
  } catch {
    /* ignore */
  }
  return res.statusText || `Request failed (${res.status})`;
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  /** When true, do not send Authorization (login + public booking policy). */
  skipAuth?: boolean;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<ApiResult<T>> {
  const { method = "GET", body, skipAuth = false } = options;
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (!skipAuth) {
    const session = loadSession();
    if (session?.accessToken) {
      headers.Authorization = `Bearer ${session.accessToken}`;
    }
  }
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) {
      return err(await parseErrorMessage(res));
    }
    if (res.status === 204) {
      return ok(undefined as T);
    }
    const text = await res.text();
    if (!text) {
      return ok(undefined as T);
    }
    const data = JSON.parse(text) as T;
    return ok(data);
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : "Network error.");
  }
}

export type ApiClient = {
  login: (role: Role, accessCode: string) => Promise<ApiResult<Session>>;
  listLocations: () => Promise<ApiResult<Location[]>>;
  getSchedule: (locationId: Id) => Promise<ApiResult<SlotWithBooking[]>>;
  reserve: (role: Role, input: ReserveInput) => Promise<ApiResult<Booking>>;
  createLocation: (role: Role, input: CreateLocationInput) => Promise<ApiResult<Location>>;
  updateLocation: (role: Role, input: UpdateLocationInput) => Promise<ApiResult<Location>>;
  createSlot: (role: Role, input: CreateSlotInput) => Promise<ApiResult<TimeSlot>>;
  clearSlot: (role: Role, timeSlotId: Id) => Promise<ApiResult<{ cleared: number }>>;
  deleteSlot: (role: Role, input: DeleteSlotInput) => Promise<ApiResult<{ deleted: boolean }>>;
  deleteLocation: (role: Role, locationId: Id) => Promise<ApiResult<{ deleted: boolean }>>;
  adminAddParticipant: (role: Role, input: AdminAddParticipantInput) => Promise<ApiResult<Booking>>;
  deleteBooking: (role: Role, input: DeleteBookingInput) => Promise<ApiResult<{ deleted: boolean }>>;
  getBookingPolicy: (role: Role) => Promise<ApiResult<BookingPolicy>>;
  getPublicBookingPolicy: () => Promise<ApiResult<BookingPolicy>>;
  setGlobalBookingLock: (role: Role, input: SetGlobalBookingLockInput) => Promise<ApiResult<BookingPolicy>>;
  setLocationBookingLock: (role: Role, input: SetLocationBookingLockInput) => Promise<ApiResult<BookingPolicy>>;
  setMapPhoto: (role: Role, input: { mapPhotoUrl: string | null }) => Promise<ApiResult<BookingPolicy>>;

  listMapLocations: (role: Role) => Promise<ApiResult<MapLocationDraft[]>>;
  createMapLocation: (
    role: Role,
    input: { positionNumber: number; title: string; photoUrl?: string | null },
  ) => Promise<ApiResult<MapLocationDraft>>;
  updateMapLocation: (
    role: Role,
    input: { id: Id; positionNumber?: number; title?: string; photoUrl?: string | null },
  ) => Promise<ApiResult<MapLocationDraft>>;
  deleteMapLocation: (role: Role, input: { id: Id }) => Promise<ApiResult<{ deleted: boolean }>>;
};

export const apiClient: ApiClient = {
  async login(role, accessCode) {
    return request<Session>("/auth/login", {
      method: "POST",
      skipAuth: true,
      body: { role, accessCode },
    });
  },
  async listLocations() {
    return request<Location[]>("/locations");
  },
  async getSchedule(locationId) {
    return request<SlotWithBooking[]>(`/locations/${encodeURIComponent(locationId)}/schedule`);
  },
  async reserve(role, input) {
    if (role !== "participant") return err("Participant access required.");
    return request<Booking>("/bookings/reserve", { method: "POST", body: input });
  },
  async createLocation(role: Role, input) {
    void role;
    return request<Location>("/locations", { method: "POST", body: input });
  },
  async updateLocation(role: Role, input) {
    void role;
    const { locationId, ...rest } = input;
    const body: Record<string, unknown> = {};
    if (rest.title !== undefined) body.title = rest.title;
    if (rest.googleMapsUrl !== undefined) body.googleMapsUrl = rest.googleMapsUrl;
    if (rest.description !== undefined) body.description = rest.description;
    if (rest.photoUrls !== undefined) body.photoUrls = rest.photoUrls;
    if (rest.status !== undefined) body.status = rest.status;
    return request<Location>(`/locations/${encodeURIComponent(locationId)}`, {
      method: "PATCH",
      body,
    });
  },
  async createSlot(role: Role, input) {
    void role;
    const { locationId, startTimeIso, endTimeIso, capacity } = input;
    return request<TimeSlot>(`/locations/${encodeURIComponent(locationId)}/slots`, {
      method: "POST",
      body: { startTimeIso, endTimeIso, capacity },
    });
  },
  async clearSlot(role: Role, timeSlotId) {
    void role;
    return request<{ cleared: number }>(
      `/slots/${encodeURIComponent(timeSlotId)}/clear`,
      { method: "POST" },
    );
  },
  async deleteSlot(role: Role, input) {
    void role;
    return request<{ deleted: boolean }>(`/slots/${encodeURIComponent(input.timeSlotId)}`, {
      method: "DELETE",
    });
  },
  async deleteLocation(role: Role, locationId) {
    void role;
    return request<{ deleted: boolean }>(`/locations/${encodeURIComponent(locationId)}`, {
      method: "DELETE",
    });
  },
  async adminAddParticipant(role, input) {
    if (role !== "admin") return err("Admin access required.");
    return request<Booking>("/bookings/admin", { method: "POST", body: input });
  },
  async deleteBooking(role: Role, input) {
    void role;
    return request<{ deleted: boolean }>(
      `/bookings/${encodeURIComponent(input.bookingId)}`,
      { method: "DELETE" },
    );
  },
  async getBookingPolicy(role: Role) {
    void role;
    return request<BookingPolicy>("/booking-policy", { skipAuth: true });
  },
  async getPublicBookingPolicy() {
    return request<BookingPolicy>("/booking-policy", { skipAuth: true });
  },
  async setGlobalBookingLock(role: Role, input) {
    void role;
    return request<BookingPolicy>("/booking-policy/global", {
      method: "PATCH",
      body: { isLocked: input.isLocked },
    });
  },
  async setLocationBookingLock(role: Role, input) {
    void role;
    return request<BookingPolicy>(
      `/booking-policy/locations/${encodeURIComponent(input.locationId)}`,
      { method: "PATCH", body: { isLocked: input.isLocked } },
    );
  },
  async setMapPhoto(role: Role, input) {
    if (role !== "admin") return err("Admin access required.");
    return request<BookingPolicy>("/booking-policy/map-photo", {
      method: "PATCH",
      body: { mapPhotoUrl: input.mapPhotoUrl ?? "" },
    });
  },

  async listMapLocations(role) {
    if (role !== "admin") return err("Admin access required.");
    return request<MapLocationDraft[]>("/map-locations");
  },
  async createMapLocation(role, input) {
    if (role !== "admin") return err("Admin access required.");
    return request<MapLocationDraft>("/map-locations", {
      method: "POST",
      body: {
        positionNumber: input.positionNumber,
        title: input.title,
        photoUrl: input.photoUrl ?? undefined,
      },
    });
  },
  async updateMapLocation(role, input) {
    if (role !== "admin") return err("Admin access required.");
    const { id, ...rest } = input;
    const body: Record<string, unknown> = {};
    if (rest.positionNumber !== undefined) body.positionNumber = rest.positionNumber;
    if (rest.title !== undefined) body.title = rest.title;
    if (rest.photoUrl !== undefined) body.photoUrl = rest.photoUrl ?? "";
    return request<MapLocationDraft>(`/map-locations/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body,
    });
  },
  async deleteMapLocation(role, input) {
    if (role !== "admin") return err("Admin access required.");
    return request<{ deleted: boolean }>(`/map-locations/${encodeURIComponent(input.id)}`, {
      method: "DELETE",
    });
  },
};
