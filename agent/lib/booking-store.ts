import type { BookingRequest } from "./types.js";

const bookings = new Map<string, BookingRequest>();

function id(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function createBookingRequest(
  input: Omit<BookingRequest, "id" | "createdAt">,
): Promise<BookingRequest> {
  const booking: BookingRequest = {
    ...input,
    id: id("bk"),
    createdAt: new Date().toISOString(),
  };

  bookings.set(booking.id, booking);
  return booking;
}

export async function listBookingRequests(): Promise<BookingRequest[]> {
  return Array.from(bookings.values()).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

export async function readBookingRequest(id: string): Promise<BookingRequest | null> {
  return bookings.get(id) ?? null;
}
