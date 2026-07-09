"use server";

import { revalidatePath } from "next/cache";
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
