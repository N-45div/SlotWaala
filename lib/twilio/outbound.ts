import twilio from "twilio";
import { confirmSlotHold } from "@/lib/availability";
import { createSqlClient } from "@/lib/neon/server";
import { scheduleBookingReminder } from "@/lib/reminders";

type ApprovedBooking = {
  id: string;
  conversation_id: string;
  customer_phone: string;
  business_whatsapp_number: string | null;
  service: string | null;
  preferred_slot: string | null;
  agent_draft: string | null;
};

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required for outbound WhatsApp sending.`);
  }

  return value;
}

function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function fallbackConfirmation(booking: ApprovedBooking) {
  const service = booking.service ?? "your booking";
  const slot = booking.preferred_slot ? ` for ${booking.preferred_slot}` : "";
  return `Confirmed: ${service}${slot}. We will send a reminder before the appointment.`;
}

async function readApprovedBooking(bookingRequestId: string): Promise<ApprovedBooking> {
  const sql = createSqlClient();
  const rows = await sql`
    select
      br.id,
      br.conversation_id,
      c.phone as customer_phone,
      b.whatsapp_number as business_whatsapp_number,
      br.service,
      br.preferred_slot,
      br.agent_draft
    from booking_requests br
    join customers c on c.id = br.customer_id
    join businesses b on b.id = br.business_id
    where br.id = ${bookingRequestId}
      and br.status in ('approved', 'needs_owner_approval')
    limit 1
  `;
  const booking = rows[0] as ApprovedBooking | undefined;

  if (!booking) {
    throw new Error("Approved booking request was not found.");
  }

  return booking;
}

export async function sendApprovedBookingConfirmation(input: {
  bookingRequestId: string;
  draftText?: string;
}) {
  const booking = await readApprovedBooking(input.bookingRequestId);
  const body = input.draftText?.trim() || booking.agent_draft || fallbackConfirmation(booking);
  const from = booking.business_whatsapp_number ?? requireEnv("TWILIO_MESSAGING_FROM");
  const client = twilio(requireEnv("TWILIO_ACCOUNT_SID"), requireEnv("TWILIO_AUTH_TOKEN"));
  const message = await client.messages.create({
    from,
    to: booking.customer_phone,
    body,
    statusCallback: env("TWILIO_STATUS_CALLBACK_URL"),
  });
  const sql = createSqlClient();

  await sql`
    insert into messages (conversation_id, direction, body, external_id)
    values (${booking.conversation_id}, 'outbound', ${body}, ${message.sid})
    on conflict (external_id)
    where external_id is not null
    do update set body = excluded.body
  `;

  await sql`
    update booking_requests
    set
      status = 'confirmed',
      agent_draft = ${body},
      updated_at = now()
    where id = ${booking.id}
  `;

  await confirmSlotHold(booking.id);

  await scheduleBookingReminder({
    bookingRequestId: booking.id,
  });

  return {
    sid: message.sid,
    body,
  };
}
