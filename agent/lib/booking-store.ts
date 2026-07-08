import { createSqlClient } from "../../lib/neon/server.js";
import { attachTraceToBooking } from "./trace-store.js";

export type StoredBookingRequest = {
  id: string;
  business_id: string;
  customer_id: string;
  conversation_id: string;
  service: string | null;
  area: string | null;
  preferred_slot: string | null;
  status:
    | "needs_info"
    | "needs_owner_approval"
    | "confirmed"
    | "rejected"
    | "escalated";
  missing_fields: string[];
  agent_draft: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateBookingRequestInput = {
  businessId: string;
  customerId: string;
  conversationId: string;
  service?: string;
  area?: string;
  preferredSlot?: string;
  missingFields: string[];
  agentDraft?: string;
  status: StoredBookingRequest["status"];
  meshTraceId?: string;
};

export async function createBookingRequest(
  input: CreateBookingRequestInput,
): Promise<StoredBookingRequest> {
  const sql = createSqlClient();
  const rows = await sql`
    insert into booking_requests (
      business_id,
      customer_id,
      conversation_id,
      service,
      area,
      preferred_slot,
      status,
      missing_fields,
      agent_draft
    )
    values (
      ${input.businessId},
      ${input.customerId},
      ${input.conversationId},
      ${input.service ?? null},
      ${input.area ?? null},
      ${input.preferredSlot ?? null},
      ${input.status},
      ${input.missingFields},
      ${input.agentDraft ?? null}
    )
    returning
      id,
      business_id,
      customer_id,
      conversation_id,
      service,
      area,
      preferred_slot,
      status,
      missing_fields,
      agent_draft,
      created_at,
      updated_at
  `;

  const booking = rows[0] as StoredBookingRequest;

  if (input.meshTraceId) {
    await attachTraceToBooking({
      traceId: input.meshTraceId,
      bookingRequestId: booking.id,
    });
  }

  return booking;
}

export async function listBookingRequests(input: {
  businessId: string;
  limit?: number;
}): Promise<StoredBookingRequest[]> {
  const sql = createSqlClient();
  const rows = await sql`
    select
      id,
      business_id,
      customer_id,
      conversation_id,
      service,
      area,
      preferred_slot,
      status,
      missing_fields,
      agent_draft,
      created_at,
      updated_at
    from booking_requests
    where business_id = ${input.businessId}
    order by updated_at desc
    limit ${input.limit ?? 50}
  `;

  return rows as StoredBookingRequest[];
}

export async function readBookingRequest(id: string): Promise<StoredBookingRequest | null> {
  const sql = createSqlClient();
  const rows = await sql`
    select
      id,
      business_id,
      customer_id,
      conversation_id,
      service,
      area,
      preferred_slot,
      status,
      missing_fields,
      agent_draft,
      created_at,
      updated_at
    from booking_requests
    where id = ${id}
    limit 1
  `;

  return (rows[0] as StoredBookingRequest | undefined) ?? null;
}
