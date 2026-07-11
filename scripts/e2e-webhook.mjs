import { neon } from "@neondatabase/serverless";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const localEnv = path.join(here, "..", ".env.local");
if (fs.existsSync(localEnv)) {
  for (const line of fs.readFileSync(localEnv, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for the real webhook eval.`);
  return value;
}

const sql = neon(requireEnv("DATABASE_URL"));
const webhookUrl = requireEnv("SLOTWAALA_E2E_WEBHOOK_URL");
const customerPhone = requireEnv("SLOTWAALA_E2E_CUSTOMER_WHATSAPP");
const businessPhone = requireEnv("TWILIO_MESSAGING_FROM");
const runId = `slotwaala-webhook-e2e-${Date.now()}`;
const body = `E2E ${runId}: AC service chahiye tomorrow 4 PM, Koramangala. Please book.`;
const messageSid = `SM${runId.replace(/\D/g, "").slice(-30)}`;

const form = new URLSearchParams({
  From: customerPhone.startsWith("whatsapp:") ? customerPhone : `whatsapp:${customerPhone}`,
  To: businessPhone.startsWith("whatsapp:") ? businessPhone : `whatsapp:${businessPhone}`,
  Body: body,
  MessageSid: messageSid,
});
const response = await fetch(webhookUrl, {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: form,
});
if (!response.ok) throw new Error(`Webhook returned ${response.status}: ${await response.text()}`);

const deadline = Date.now() + 45_000;
let booking;
while (Date.now() < deadline) {
  const rows = await sql`
    select br.id, br.status, br.service, br.area, br.preferred_slot, br.agent_draft,
           c.phone,
           (select count(*)::int from mesh_traces mt where mt.booking_request_id = br.id
             or mt.conversation_id = br.conversation_id) as trace_count
    from booking_requests br
    join businesses b on b.id = br.business_id
    join customers c on c.id = br.customer_id
    where b.whatsapp_number = ${businessPhone}
      and c.phone = ${customerPhone}
      and br.updated_at >= now() - interval '2 minutes'
    order by br.updated_at desc
    limit 1
  `;
  booking = rows[0];
  if (booking && Number(booking.trace_count) > 0) break;
  await new Promise((resolve) => setTimeout(resolve, 1500));
}

if (!booking) throw new Error("Real webhook did not create a booking request within 45 seconds.");
if (Number(booking.trace_count) === 0) throw new Error("Booking was created without Mesh traces.");

console.log(JSON.stringify({
  ok: true,
  runId,
  webhookUrl,
  bookingRequestId: booking.id,
  status: booking.status,
  service: booking.service,
  area: booking.area,
  preferredSlot: booking.preferred_slot,
  traceCount: booking.trace_count,
  note: "Inbound path verified through the configured Eve/Twilio webhook. Owner approval remains a deliberate dashboard action.",
}, null, 2));
