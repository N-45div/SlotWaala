"use server";

import { revalidatePath } from "next/cache";
import { resolveEscalation } from "@/lib/escalations";
import { bootstrapBusiness } from "@/lib/businesses";
import { resolveBusinessId } from "@/lib/businesses";
import { requireDashboardAccess } from "@/lib/dashboard-auth";
import { createSqlClient } from "@/lib/neon/server";
import { sendRecoveryOffer } from "@/lib/recovery";
import { recordOwnerAction, updateBookingDraft, type OwnerActionKind } from "@/lib/owner-actions";
import { sendApprovedBookingConfirmation } from "@/lib/twilio/outbound";

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

async function submitOwnerAction(formData: FormData, action: OwnerActionKind) {
  await requireDashboardAccess();
  const bookingRequestId = readString(formData, "bookingRequestId");
  const businessId = await resolveBusinessId();

  if (!bookingRequestId || !businessId) {
    throw new Error("bookingRequestId is required.");
  }

  await recordOwnerAction({
    bookingRequestId,
    businessId,
    action,
    note: readString(formData, "note"),
    draftText: readString(formData, "draftText"),
  });
  revalidatePath("/");
}

export async function approveBooking(formData: FormData) {
  await requireDashboardAccess();
  const bookingRequestId = readString(formData, "bookingRequestId");
  const draftText = readString(formData, "draftText");
  const businessId = await resolveBusinessId();

  if (!bookingRequestId || !businessId) {
    throw new Error("bookingRequestId is required.");
  }

  await recordOwnerAction({
    bookingRequestId,
    businessId,
    action: "approve",
    draftText,
  });
  await sendApprovedBookingConfirmation({
    bookingRequestId,
    draftText,
    businessId,
  });
  revalidatePath("/");
}

export async function rejectBooking(formData: FormData) {
  await submitOwnerAction(formData, "reject");
}

export async function requestBookingInfo(formData: FormData) {
  await submitOwnerAction(formData, "request_info");
}

export async function saveBookingDraft(formData: FormData) {
  await requireDashboardAccess();
  const bookingRequestId = readString(formData, "bookingRequestId");
  const businessId = await resolveBusinessId();
  const draftText = readString(formData, "draftText").trim();
  if (!bookingRequestId || !businessId || !draftText) throw new Error("A draft reply is required.");
  await updateBookingDraft({ bookingRequestId, businessId, draftText });
  revalidatePath("/");
}

export async function sendConfirmation(formData: FormData) {
  await requireDashboardAccess();
  const bookingRequestId = readString(formData, "bookingRequestId");
  const draftText = readString(formData, "draftText");
  const businessId = await resolveBusinessId();

  if (!bookingRequestId || !businessId) {
    throw new Error("bookingRequestId is required.");
  }

  await sendApprovedBookingConfirmation({
    bookingRequestId,
    draftText,
    businessId,
  });
  revalidatePath("/");
}

export async function saveAvailabilityWindow(formData: FormData) {
  await requireDashboardAccess();
  const businessId = readString(formData, "businessId");
  const activeBusinessId = await resolveBusinessId();
  const weekday = Number(readString(formData, "weekday"));
  const startTime = readString(formData, "startTime");
  const endTime = readString(formData, "endTime");
  const slotMinutes = Number(readString(formData, "slotMinutes"));
  const service = readString(formData, "service");

  if (!businessId || businessId !== activeBusinessId || !Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
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
  await requireDashboardAccess();
  const availabilityWindowId = readString(formData, "availabilityWindowId");
  const businessId = await resolveBusinessId();
  if (!availabilityWindowId || !businessId) {
    throw new Error("availabilityWindowId is required.");
  }

  const sql = createSqlClient();
  await sql`
    update availability_windows
    set active = false
    where id = ${availabilityWindowId}
      and business_id = ${businessId}
  `;
  revalidatePath("/");
}

export async function resolveEscalationAction(formData: FormData) {
  await requireDashboardAccess();
  const escalationId = readString(formData, "escalationId");
  const businessId = await resolveBusinessId();
  if (!escalationId || !businessId) {
    throw new Error("escalationId is required.");
  }

  await resolveEscalation(escalationId, businessId);
  revalidatePath("/");
}

export async function sendRecoveryOfferAction(formData: FormData) {
  await requireDashboardAccess();
  const recoveryOfferId = readString(formData, "recoveryOfferId");
  const businessId = await resolveBusinessId();
  if (!recoveryOfferId || !businessId) {
    throw new Error("recoveryOfferId is required.");
  }

  await sendRecoveryOffer(recoveryOfferId, businessId);
  revalidatePath("/");
}

export async function bootstrapBusinessAction(formData: FormData) {
  await requireDashboardAccess();
  await bootstrapBusiness(readString(formData, "businessName"));
  revalidatePath("/");
}
