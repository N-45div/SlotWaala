"use server";

import { revalidatePath } from "next/cache";
import { resolveEscalation } from "@/lib/escalations";
import { createSqlClient } from "@/lib/neon/server";
import { sendRecoveryOffer } from "@/lib/recovery";
import { recordOwnerAction, type OwnerActionKind } from "@/lib/owner-actions";
import { sendApprovedBookingConfirmation } from "@/lib/twilio/outbound";

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

async function submitOwnerAction(formData: FormData, action: OwnerActionKind) {
  const bookingRequestId = readString(formData, "bookingRequestId");

  if (!bookingRequestId) {
    throw new Error("bookingRequestId is required.");
  }

  await recordOwnerAction({
    bookingRequestId,
    action,
    note: readString(formData, "note"),
    draftText: readString(formData, "draftText"),
  });
  revalidatePath("/");
}

export async function approveBooking(formData: FormData) {
  const bookingRequestId = readString(formData, "bookingRequestId");
  const draftText = readString(formData, "draftText");

  if (!bookingRequestId) {
    throw new Error("bookingRequestId is required.");
  }

  await recordOwnerAction({
    bookingRequestId,
    action: "approve",
    draftText,
  });
  await sendApprovedBookingConfirmation({
    bookingRequestId,
    draftText,
  });
  revalidatePath("/");
}

export async function rejectBooking(formData: FormData) {
  await submitOwnerAction(formData, "reject");
}

export async function requestBookingInfo(formData: FormData) {
  await submitOwnerAction(formData, "request_info");
}

export async function sendConfirmation(formData: FormData) {
  const bookingRequestId = readString(formData, "bookingRequestId");
  const draftText = readString(formData, "draftText");

  if (!bookingRequestId) {
    throw new Error("bookingRequestId is required.");
  }

  await sendApprovedBookingConfirmation({
    bookingRequestId,
    draftText,
  });
  revalidatePath("/");
}

export async function saveAvailabilityWindow(formData: FormData) {
  const businessId = readString(formData, "businessId");
  const weekday = Number(readString(formData, "weekday"));
  const startTime = readString(formData, "startTime");
  const endTime = readString(formData, "endTime");
  const slotMinutes = Number(readString(formData, "slotMinutes"));
  const service = readString(formData, "service");

  if (!businessId || !Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
    throw new Error("A business and valid weekday are required.");
  }

  if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime) || startTime >= endTime) {
    throw new Error("Working hours must have a valid start and end time.");
  }

  if (!Number.isInteger(slotMinutes) || slotMinutes < 15 || slotMinutes > 240) {
    throw new Error("Slot length must be between 15 and 240 minutes.");
  }

  const sql = createSqlClient();
  await sql`
    insert into availability_windows (
      business_id,
      service,
      weekday,
      start_time,
      end_time,
      slot_minutes
    )
    values (
      ${businessId},
      ${service || null},
      ${weekday},
      ${startTime},
      ${endTime},
      ${slotMinutes}
    )
  `;
  revalidatePath("/");
}

export async function removeAvailabilityWindow(formData: FormData) {
  const availabilityWindowId = readString(formData, "availabilityWindowId");
  if (!availabilityWindowId) {
    throw new Error("availabilityWindowId is required.");
  }

  const sql = createSqlClient();
  await sql`
    update availability_windows
    set active = false
    where id = ${availabilityWindowId}
  `;
  revalidatePath("/");
}

export async function resolveEscalationAction(formData: FormData) {
  const escalationId = readString(formData, "escalationId");
  if (!escalationId) {
    throw new Error("escalationId is required.");
  }

  await resolveEscalation(escalationId);
  revalidatePath("/");
}

export async function sendRecoveryOfferAction(formData: FormData) {
  const recoveryOfferId = readString(formData, "recoveryOfferId");
  if (!recoveryOfferId) {
    throw new Error("recoveryOfferId is required.");
  }

  await sendRecoveryOffer(recoveryOfferId);
  revalidatePath("/");
}
