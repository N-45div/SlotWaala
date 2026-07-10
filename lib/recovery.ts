import twilio from "twilio";
import { holdSlotForBooking, releaseSlotHold } from "@/lib/availability";
import { createSqlClient } from "@/lib/neon/server";

type WaitlistEntryRow = {
  id: string;
  business_id: string;
  customer_id: string;
  conversation_id: string;
  service: string | null;
  preferred_window: string | null;
  status: "waiting" | "offered" | "accepted" | "expired" | "removed";
  created_at: string;
};

type RecoveryOfferRow = {
  id: string;
  released_booking_request_id: string;
  waitlist_entry_id: string;
  starts_at: string;
  ends_at: string;
  status: "pending_owner" | "sent" | "accepted" | "expired" | "canceled";
  message: string | null;
  customer_name: string | null;
  customer_phone: string;
  business_whatsapp_number: string | null;
  service: string | null;
  customer_id: string;
  conversation_id: string;
};

type CancelableBookingRow = {
  id: string;
  business_id: string;
  service: string | null;
  starts_at: string | null;
  ends_at: string | null;
};

type RecoveryBookingRow = {
  id: string;
  business_id: string;
  customer_id: string;
  conversation_id: string;
  service: string | null;
  preferred_slot: string | null;
  status: string;
};

function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function requireEnv(name: string): string {
  const value = env(name);
  if (!value) throw new Error(`${name} is required for recovery offer delivery.`);
  return value;
}

function formatSlot(startsAt: string, endsAt: string) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const day = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(start);
  const startTime = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
  }).format(start);
  const endTime = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
  }).format(end);

  return `${day}, ${startTime}-${endTime}`;
}

export async function joinWaitlist(input: {
  businessId: string;
  customerId: string;
  conversationId: string;
  service?: string;
  preferredWindow?: string;
}) {
  const sql = createSqlClient();
  const existing = (await sql`
    select id, business_id, customer_id, conversation_id, service, preferred_window, status, created_at
    from waitlist_entries
    where business_id = ${input.businessId}
      and customer_id = ${input.customerId}
      and status in ('waiting', 'offered')
    order by created_at desc
    limit 1
  `) as WaitlistEntryRow[];

  if (existing[0]) return existing[0];

  const rows = (await sql`
    insert into waitlist_entries (
      business_id,
      customer_id,
      conversation_id,
      service,
      preferred_window
    )
    values (
      ${input.businessId},
      ${input.customerId},
      ${input.conversationId},
      ${input.service?.trim() || null},
      ${input.preferredWindow?.trim() || null}
    )
    returning id, business_id, customer_id, conversation_id, service, preferred_window, status, created_at
  `) as WaitlistEntryRow[];

  return rows[0];
}

export async function cancelBookingAndCreateRecoveryOffers(input: {
  businessId: string;
  conversationId: string;
}) {
  const sql = createSqlClient();
  const bookings = (await sql`
    select
      br.id,
      br.business_id,
      br.service,
      hold.starts_at,
      hold.ends_at
    from booking_requests br
    left join slot_holds hold on hold.booking_request_id = br.id
      and hold.status = 'confirmed'
    where br.business_id = ${input.businessId}
      and br.conversation_id = ${input.conversationId}
      and br.status = 'confirmed'
    order by br.updated_at desc
    limit 1
  `) as CancelableBookingRow[];
  const booking = bookings[0];

  if (!booking) {
    return { canceledBookingId: null, offers: [] as Array<{ id: string }> };
  }

  await sql`
    update booking_requests
    set status = 'canceled', updated_at = now()
    where id = ${booking.id}
  `;
  await releaseSlotHold(booking.id);

  if (!booking.starts_at || !booking.ends_at) {
    return { canceledBookingId: booking.id, offers: [] as Array<{ id: string }> };
  }

  const waitlistEntries = (await sql`
    select id, business_id, customer_id, conversation_id, service, preferred_window, status, created_at
    from waitlist_entries
    where business_id = ${booking.business_id}
      and status = 'waiting'
      and (${booking.service}::text is null or service is null or lower(service) = lower(${booking.service}))
    order by created_at asc
    limit 3
  `) as WaitlistEntryRow[];

  const offers = [] as Array<{ id: string }>;
  for (const entry of waitlistEntries) {
    const rows = (await sql`
      insert into recovery_offers (
        released_booking_request_id,
        waitlist_entry_id,
        starts_at,
        ends_at,
        message
      )
      values (
        ${booking.id},
        ${entry.id},
        ${booking.starts_at},
        ${booking.ends_at},
        ${`A ${booking.service ?? "service"} slot opened for ${formatSlot(booking.starts_at, booking.ends_at)}. Reply YES if you would like it.`}
      )
      on conflict (released_booking_request_id, waitlist_entry_id)
      do nothing
      returning id
    `) as Array<{ id: string }>;
    if (rows[0]) offers.push(rows[0]);
  }

  return { canceledBookingId: booking.id, offers };
}

async function readRecoveryOffer(recoveryOfferId: string): Promise<RecoveryOfferRow> {
  const sql = createSqlClient();
  const rows = (await sql`
    select
      offer.id,
      offer.released_booking_request_id,
      offer.waitlist_entry_id,
      offer.starts_at,
      offer.ends_at,
      offer.status,
      offer.message,
      customer.display_name as customer_name,
      customer.phone as customer_phone,
      business.whatsapp_number as business_whatsapp_number,
      waitlist.service,
      waitlist.customer_id,
      waitlist.conversation_id
    from recovery_offers offer
    join waitlist_entries waitlist on waitlist.id = offer.waitlist_entry_id
    join customers customer on customer.id = waitlist.customer_id
    join businesses business on business.id = waitlist.business_id
    where offer.id = ${recoveryOfferId}
    limit 1
  `) as RecoveryOfferRow[];
  const offer = rows[0];

  if (!offer) throw new Error("Recovery offer was not found.");
  return offer;
}

export async function sendRecoveryOffer(recoveryOfferId: string) {
  const offer = await readRecoveryOffer(recoveryOfferId);
  if (offer.status !== "pending_owner") {
    throw new Error("Only a pending recovery offer can be sent.");
  }

  const body = offer.message ?? `A service slot opened for ${formatSlot(offer.starts_at, offer.ends_at)}. Reply YES if you would like it.`;
  const client = twilio(requireEnv("TWILIO_ACCOUNT_SID"), requireEnv("TWILIO_AUTH_TOKEN"));
  const message = await client.messages.create({
    from: offer.business_whatsapp_number ?? requireEnv("TWILIO_MESSAGING_FROM"),
    to: offer.customer_phone,
    body,
    statusCallback: env("TWILIO_STATUS_CALLBACK_URL"),
  });
  const sql = createSqlClient();

  await sql`
    update recovery_offers
    set status = 'sent', external_id = ${message.sid}, sent_at = now()
    where id = ${offer.id}
  `;
  await sql`
    update waitlist_entries
    set status = 'offered', updated_at = now()
    where id = ${offer.waitlist_entry_id}
  `;
  await sql`
    update recovery_offers
    set status = 'canceled'
    where released_booking_request_id = ${offer.released_booking_request_id}
      and id <> ${offer.id}
      and status = 'pending_owner'
  `;

  return { sid: message.sid, body };
}

export async function acceptRecoveryOfferForConversation(input: {
  businessId: string;
  customerId: string;
  conversationId: string;
}) {
  const sql = createSqlClient();
  const rows = (await sql`
    select
      offer.id,
      offer.released_booking_request_id,
      offer.waitlist_entry_id,
      offer.starts_at,
      offer.ends_at,
      offer.status,
      offer.message,
      customer.display_name as customer_name,
      customer.phone as customer_phone,
      business.whatsapp_number as business_whatsapp_number,
      waitlist.service,
      waitlist.customer_id,
      waitlist.conversation_id
    from recovery_offers offer
    join waitlist_entries waitlist on waitlist.id = offer.waitlist_entry_id
    join customers customer on customer.id = waitlist.customer_id
    join businesses business on business.id = waitlist.business_id
    where waitlist.business_id = ${input.businessId}
      and waitlist.customer_id = ${input.customerId}
      and waitlist.conversation_id = ${input.conversationId}
      and offer.status = 'sent'
      and offer.starts_at > now()
    order by offer.sent_at desc
    limit 1
  `) as RecoveryOfferRow[];
  const offer = rows[0];

  if (!offer) {
    return { accepted: false, booking: null };
  }

  const bookingRows = (await sql`
    insert into booking_requests (
      business_id,
      customer_id,
      conversation_id,
      service,
      preferred_slot,
      missing_fields,
      agent_draft,
      status
    )
    values (
      ${input.businessId},
      ${input.customerId},
      ${input.conversationId},
      ${offer.service},
      ${offer.starts_at},
      ${[]},
      ${`A recovery slot is ready for owner confirmation: ${formatSlot(offer.starts_at, offer.ends_at)}.`},
      'needs_owner_approval'
    )
    returning id, business_id, customer_id, conversation_id, service, preferred_slot, status
  `) as RecoveryBookingRow[];
  const booking = bookingRows[0];
  await holdSlotForBooking({
    businessId: input.businessId,
    bookingRequestId: booking.id,
    startsAt: offer.starts_at,
    endsAt: offer.ends_at,
  });

  await sql`
    update recovery_offers
    set status = 'accepted', accepted_at = now()
    where id = ${offer.id}
  `;
  await sql`
    update waitlist_entries
    set status = 'accepted', updated_at = now()
    where id = ${offer.waitlist_entry_id}
  `;

  return { accepted: true, booking };
}
