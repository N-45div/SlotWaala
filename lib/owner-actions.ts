import { createSqlClient } from "@/lib/neon/server";
import { releaseSlotHold } from "@/lib/availability";

export type OwnerActionKind = "approve" | "reject" | "request_info" | "escalate";

type BookingStatus =
  | "needs_info"
  | "needs_owner_approval"
  | "approved"
  | "confirmed"
  | "rejected"
  | "escalated";

function statusForAction(action: OwnerActionKind): BookingStatus {
  if (action === "approve") return "approved";
  if (action === "reject") return "rejected";
  if (action === "escalate") return "escalated";
  return "needs_info";
}

export async function updateBookingDraft(input: {
  bookingRequestId: string;
  businessId: string;
  draftText: string;
}) {
  const sql = createSqlClient();
  const updated = await sql`
    update booking_requests
    set agent_draft = ${input.draftText.trim()}, updated_at = now()
    where id = ${input.bookingRequestId}
      and business_id = ${input.businessId}
      and status in ('needs_info', 'needs_owner_approval', 'approved')
    returning id
  `;
  if (updated.length === 0) throw new Error("Booking request cannot be edited in its current state.");
}

export async function recordOwnerAction(input: {
  bookingRequestId: string;
  businessId: string;
  action: OwnerActionKind;
  note?: string;
  draftText?: string;
}) {
  const sql = createSqlClient();
  const nextStatus = statusForAction(input.action);

  const updated = await sql`
    update booking_requests
    set
      status = ${nextStatus},
      agent_draft = coalesce(${input.draftText?.trim() || null}, agent_draft),
      updated_at = now()
    where id = ${input.bookingRequestId}
      and business_id = ${input.businessId}
    returning id
  `;

  if (updated.length === 0) {
    throw new Error("Booking request is not part of the active business.");
  }

  await sql`
    insert into owner_actions (
      booking_request_id,
      action,
      note,
      draft_text
    )
    values (
      ${input.bookingRequestId},
      ${input.action},
      ${input.note?.trim() || null},
      ${input.draftText?.trim() || null}
    )
  `;

  if (input.action === "reject" || input.action === "request_info" || input.action === "escalate") {
    await releaseSlotHold(input.bookingRequestId);
  }
}
