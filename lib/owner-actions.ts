import { createSqlClient } from "@/lib/neon/server";

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

export async function recordOwnerAction(input: {
  bookingRequestId: string;
  action: OwnerActionKind;
  note?: string;
  draftText?: string;
}) {
  const sql = createSqlClient();
  const nextStatus = statusForAction(input.action);

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

  await sql`
    update booking_requests
    set
      status = ${nextStatus},
      agent_draft = coalesce(${input.draftText?.trim() || null}, agent_draft),
      updated_at = now()
    where id = ${input.bookingRequestId}
  `;
}
