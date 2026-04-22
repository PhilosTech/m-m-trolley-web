export type Role = "participant" | "admin";

export type Id = string;

export type LocationStatus = "draft" | "published";

export type Location = {
  id: Id;
  title: string;
  googleMapsUrl?: string;
  photoUrls: string[];
  description?: string;
  status: LocationStatus;
};

export type TimeSlot = {
  id: Id;
  locationId: Id;
  startTimeIso: string;
  endTimeIso: string;
  capacity: number;
};

export type Booking = {
  id: Id;
  timeSlotId: Id;
  participantName: string;
  seats: number;
  createdAtIso: string;
};

export type SlotWithBooking = {
  slot: TimeSlot;
  bookedSeats: number;
  bookings: Booking[];
};

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL_ERROR";

export type ApiError = {
  code: ApiErrorCode;
  message: string;
};

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };

export type Session = {
  role: Role;
  accessToken: string;
};

export type CreateLocationInput = {
  title: string;
  googleMapsUrl?: string;
  description?: string;
  photoUrls?: string[];
};

export type UpdateLocationInput = {
  locationId: Id;
  title?: string;
  googleMapsUrl?: string;
  description?: string;
  photoUrls?: string[];
  status?: LocationStatus;
};

export type CreateSlotInput = {
  locationId: Id;
  startTimeIso: string;
  endTimeIso: string;
  capacity: number;
};

export type DeleteSlotInput = {
  timeSlotId: Id;
};

export type AdminAddParticipantInput = {
  timeSlotId: Id;
  participantName: string;
  seats: number;
};

export type DeleteBookingInput = {
  bookingId: Id;
};

export type BookingPolicy = {
  isGlobalLocked: boolean;
  lockedLocationIds: Id[];
};

export type SetGlobalBookingLockInput = {
  isLocked: boolean;
};

export type SetLocationBookingLockInput = {
  locationId: Id;
  isLocked: boolean;
};

export type ReserveInput = {
  timeSlotId: Id;
  participantName: string;
  seats: number;
};
