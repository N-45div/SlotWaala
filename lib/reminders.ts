import twilio from "twilio";
import { createSqlClient } from "./neon/server";

type BookingForReminder = {
  id: string;
  conversation_id: string;
  customer_id: string;
  customer_phone: string;
  business_whatsapp_number: string | null;
  service: string | null;
  preferred_slot: string | null;
};

type DueReminder = {
  id: string;
  booking_request_id: string;
  conversation_id: string;
  customer_phone: string;
  business_whatsapp_number: string | null;
  message: string;
};

function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function requireEnv(name: string): string {
  const value = env(name);
  if (!value) {
    throw new Error(`${name} is required for reminder delivery.`);
  }

  return value;
}

function reminderLeadMinutes() {
  const raw = Number(env("SLOTWAALA_REMINDER_LEAD_MINUTES") ?? "60");
  return Number.isFinite(raw) && raw > 0 ? raw : 60;
}

function parsePreferredSlot(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function defaultReminderTime(preferredSlot: string | null) {
  const parsedSlot = parsePreferredSlot(preferredSlot);
  const base = parsedSlot ?? new Date(Date.now() + 24 * 60 * 60 * 1000);
  return new Date(base.getTime() - reminderLeadMinutes() * 60 * 1000);
}

function defaultReminderMessage(booking: BookingForReminder) {
  const service = booking.service ?? "your booking";
  const slot = booking.preferred_slot ? ` at ${booking.preferred_slot}` : "";
  return `Reminder: ${service}${slot} is coming up. Reply here if you need to update anything.`;
}

export async function scheduleBookingReminder(input: {
  bookingRequestId: string;
  reminderAt?: string;
  message?: string;
}) {
  const sql = createSqlClient();
  const bookingRows = await sql`
    select
      br.id,
      br.conversation_id,
      br.customer_id,
      c.phone as customer_phone,
      b.whatsapp_number as business_whatsapp_number,
      br.service,
      br.preferred_slot
    from booking_requests br
    join customers c on c.id = br.customer_id
    join businesses b on b.id = br.business_id
    where br.id = ${input.bookingRequestId}
    limit 1
  `;
  const booking = bookingRows[0] as BookingForReminder | undefined;

  if (!booking) {
    throw new Error("Booking request was not found for reminder scheduling.");
  }

  const remindAt = input.reminderAt
    ? new Date(input.reminderAt)
    : defaultReminderTime(booking.preferred_slot);

  if (Number.isNaN(remindAt.getTime())) {
    throw new Error("reminderAt must be a valid date string.");
  }

  await sql`
    update reminders
    set status = 'canceled'
    where booking_request_id = ${booking.id}
      and status = 'scheduled'
  `;

  const rows = await sql`
    insert into reminders (
      booking_request_id,
      conversation_id,
      customer_id,
      remind_at,
      message
    )
    values (
      ${booking.id},
      ${booking.conversation_id},
      ${booking.customer_id},
      ${remindAt.toISOString()},
      ${input.message?.trim() || defaultReminderMessage(booking)}
    )
    returning id, booking_request_id, conversation_id, customer_id, remind_at, message, status, external_id, last_error, created_at, sent_at
  `;

  return rows[0];
}

async function sendReminder(reminder: DueReminder) {
  const from = reminder.business_whatsapp_number ?? requireEnv("TWILIO_MESSAGING_FROM");
  const client = twilio(requireEnv("TWILIO_ACCOUNT_SID"), requireEnv("TWILIO_AUTH_TOKEN"));
  return client.messages.create({
    from,
    to: reminder.customer_phone,
    body: reminder.message,
    statusCallback: env("TWILIO_STATUS_CALLBACK_URL"),
  });
}

export async function sendDueReminders(limit = 20) {
  const sql = createSqlClient();
  const dueReminders = (await sql`
    update reminders
    set status = 'sending'
    where id in (
      select id
      from reminders
      where status = 'scheduled'
        and remind_at <= now()
      order by remind_at asc
      limit ${limit}
      for update skip locked
    )
    returning id
  `) as Array<{ id: string }>;

  const results = [];

  for (const due of dueReminders) {
    const rows = (await sql`
      select
        r.id,
        r.booking_request_id,
        r.conversation_id,
        c.phone as customer_phone,
        b.whatsapp_number as business_whatsapp_number,
        r.message
      from reminders r
      join booking_requests br on br.id = r.booking_request_id
      join customers c on c.id = r.customer_id
      join businesses b on b.id = br.business_id
      where r.id = ${due.id}
      limit 1
    `) as DueReminder[];
    const reminder = rows[0];

    if (!reminder) {
      continue;
    }

    try {
      const message = await sendReminder(reminder);
      await sql`
        insert into messages (conversation_id, direction, body, external_id)
        values (${reminder.conversation_id}, 'outbound', ${reminder.message}, ${message.sid})
        on conflict (external_id)
        where external_id is not null
        do update set body = excluded.body
      `;
      await sql`
        update reminders
        set status = 'sent', external_id = ${message.sid}, sent_at = now(), last_error = null
        where id = ${reminder.id}
      `;
      results.push({ id: reminder.id, status: "sent", sid: message.sid });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown reminder send error.";
      await sql`
        update reminders
        set status = 'failed', last_error = ${message}
        where id = ${reminder.id}
      `;
      results.push({ id: reminder.id, status: "failed", error: message });
    }
  }

  return results;
}
