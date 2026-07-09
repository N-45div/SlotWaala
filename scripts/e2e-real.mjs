import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
import twilio from "twilio";

function loadLocalEnv() {
  try {
    const content = readFileSync(".env.local", "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const separator = trimmed.indexOf("=");
      if (separator === -1) continue;

      const key = trimmed.slice(0, separator).trim();
      const value = trimmed.slice(separator + 1).trim();
      if (key && process.env[key] === undefined) {
        process.env[key] = value.replace(/^['"]|['"]$/g, "");
      }
    }
  } catch {
    // .env.local is optional; CI can provide env directly.
  }
}

loadLocalEnv();

const now = new Date();
const runId = `slotwaala-e2e-${now.toISOString()}`;
const meshBaseUrl = process.env.MESH_BASE_URL ?? "https://api.meshapi.ai/v1";

const taskModelDefaults = {
  classify_inbound: "amazon/nova-micro-v1",
  extract_booking_details: "amazon/nova-lite-v1",
  draft_customer_reply: "amazon/nova-lite-v1",
  check_message_policy: "anthropic/claude-haiku-4.5",
};

const taskModelEnv = {
  classify_inbound: "MESH_CLASSIFIER_MODEL",
  extract_booking_details: "MESH_EXTRACTION_MODEL",
  draft_customer_reply: "MESH_DRAFT_MODEL",
  check_message_policy: "MESH_POLICY_MODEL",
};

const required = [
  "DATABASE_URL",
  "MESH_API_KEY",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_MESSAGING_FROM",
  "SLOTWAALA_E2E_CUSTOMER_WHATSAPP",
];

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for real E2E eval.`);
  return value;
}

function missingEnv() {
  return required.filter((name) => !process.env[name]?.trim());
}

function modelForMeshTask(task) {
  const taskOverride = taskModelEnv[task] ? process.env[taskModelEnv[task]]?.trim() : undefined;
  if (taskOverride) return taskOverride;

  if (task === "check_message_policy") {
    return process.env.MESH_REASONING_MODEL ?? taskModelDefaults[task];
  }

  if (task === "classify_inbound") {
    return process.env.MESH_FAST_MODEL ?? taskModelDefaults[task];
  }

  return taskModelDefaults[task] ?? process.env.MESH_DEFAULT_MODEL ?? "amazon/nova-lite-v1";
}

async function generateMeshJson({ task, system, prompt }) {
  const model = modelForMeshTask(task);
  const startedAt = Date.now();
  const response = await fetch(`${meshBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${requireEnv("MESH_API_KEY")}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: `${prompt}\n\nReturn JSON only.` },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Mesh ${task} failed with ${response.status}: ${await response.text()}`);
  }

  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error(`Mesh ${task} returned no content.`);

  return {
    object: JSON.parse(content),
    trace: {
      task,
      model,
      latencyMs: Date.now() - startedAt,
      inputSummary: prompt.slice(0, 180),
      outputSummary: content.slice(0, 180),
    },
  };
}

async function insertTrace(sql, { trace, bookingRequestId = null, conversationId = null, messageId = null }) {
  const rows = await sql`
    insert into mesh_traces (
      booking_request_id,
      conversation_id,
      message_id,
      task,
      model,
      latency_ms,
      input_summary,
      output_summary
    )
    values (
      ${bookingRequestId},
      ${conversationId},
      ${messageId},
      ${trace.task},
      ${trace.model},
      ${trace.latencyMs},
      ${trace.inputSummary},
      ${trace.outputSummary}
    )
    returning id
  `;

  return rows[0].id;
}

function reminderMessage(service, slot) {
  return `Reminder: ${service}${slot ? ` at ${slot}` : ""} is coming up. Reply here if you need to update anything.`;
}

async function main() {
  const missing = missingEnv();
  if (missing.length > 0) {
    throw new Error(`Missing required env: ${missing.join(", ")}`);
  }

  const sql = neon(requireEnv("DATABASE_URL"));
  const customerPhone = requireEnv("SLOTWAALA_E2E_CUSTOMER_WHATSAPP");
  const businessPhone = requireEnv("TWILIO_MESSAGING_FROM");
  const customerMessage =
    `E2E ${runId}: AC service chahiye tomorrow 4 PM, Koramangala. Please book.`;

  const businessRows = await sql`
    insert into businesses (name, whatsapp_number)
    values (${process.env.SLOTWAALA_BUSINESS_NAME ?? "SlotWaala E2E Business"}, ${businessPhone})
    on conflict (whatsapp_number)
    where whatsapp_number is not null
    do update set name = excluded.name
    returning id
  `;
  const businessId = businessRows[0].id;

  const customerRows = await sql`
    insert into customers (business_id, phone, display_name)
    values (${businessId}, ${customerPhone}, ${`E2E Customer ${runId}`})
    on conflict (business_id, phone)
    do update set display_name = excluded.display_name
    returning id
  `;
  const customerId = customerRows[0].id;

  const conversationRows = await sql`
    insert into conversations (business_id, customer_id, channel)
    values (${businessId}, ${customerId}, 'whatsapp')
    returning id
  `;
  const conversationId = conversationRows[0].id;

  const inboundRows = await sql`
    insert into messages (conversation_id, direction, body, external_id)
    values (${conversationId}, 'inbound', ${customerMessage}, ${runId})
    returning id
  `;
  const inboundMessageId = inboundRows[0].id;

  const classification = await generateMeshJson({
    task: "classify_inbound",
    system:
      "Classify this WhatsApp message for SlotWaala. Return intent, language, urgency, sensitiveDataRisk, summary, shouldExtractBookingDetails.",
    prompt: JSON.stringify({ from: customerPhone, message: customerMessage }),
  });
  const classificationTraceId = await insertTrace(sql, {
    trace: classification.trace,
    conversationId,
    messageId: inboundMessageId,
  });

  const policy = await generateMeshJson({
    task: "check_message_policy",
    system:
      "Check whether this SlotWaala message is safe for automation. Return allowedToContinue, shouldEscalate, riskLevel, riskReasons, blockedFields, ownerNote.",
    prompt: JSON.stringify({ intent: classification.object.intent, message: customerMessage }),
  });
  await insertTrace(sql, {
    trace: policy.trace,
    conversationId,
    messageId: inboundMessageId,
  });

  if (policy.object.shouldEscalate) {
    throw new Error(`Policy unexpectedly escalated safe E2E booking: ${JSON.stringify(policy.object)}`);
  }

  const extraction = await generateMeshJson({
    task: "extract_booking_details",
    system:
      "Extract only operational booking fields for SlotWaala: customerName, service, area, preferredSlot, missingFields, confidence, normalizedSummary.",
    prompt: JSON.stringify({ intent: classification.object.intent, message: customerMessage }),
  });
  const extractionTraceId = await insertTrace(sql, {
    trace: extraction.trace,
    conversationId,
    messageId: inboundMessageId,
  });

  const details = extraction.object;
  const service = details.service ?? "AC service";
  const area = details.area ?? "Koramangala";
  const preferredSlot = details.preferredSlot ?? "tomorrow 4 PM";
  const draft =
    `Confirmed: ${service} for ${preferredSlot} in ${area}. We will send a reminder before the appointment.`;

  const bookingRows = await sql`
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
      ${businessId},
      ${customerId},
      ${conversationId},
      ${service},
      ${area},
      ${preferredSlot},
      'approved',
      ${details.missingFields ?? []},
      ${draft}
    )
    returning id
  `;
  const bookingRequestId = bookingRows[0].id;
  await sql`update mesh_traces set booking_request_id = ${bookingRequestId} where id = ${classificationTraceId}`;
  await sql`update mesh_traces set booking_request_id = ${bookingRequestId} where id = ${extractionTraceId}`;

  await sql`
    insert into owner_actions (booking_request_id, action, draft_text, note)
    values (${bookingRequestId}, 'approve', ${draft}, ${`Real E2E approval ${runId}`})
  `;

  const twilioClient = twilio(requireEnv("TWILIO_ACCOUNT_SID"), requireEnv("TWILIO_AUTH_TOKEN"));
  const confirmation = await twilioClient.messages.create({
    from: businessPhone,
    to: customerPhone,
    body: draft,
    statusCallback: process.env.TWILIO_STATUS_CALLBACK_URL || undefined,
  });
  await sql`
    insert into messages (conversation_id, direction, body, external_id)
    values (${conversationId}, 'outbound', ${draft}, ${confirmation.sid})
    on conflict (external_id)
    where external_id is not null
    do update set body = excluded.body
  `;
  await sql`update booking_requests set status = 'confirmed', updated_at = now() where id = ${bookingRequestId}`;

  const reminderText = reminderMessage(service, preferredSlot);
  const reminderRows = await sql`
    insert into reminders (
      booking_request_id,
      conversation_id,
      customer_id,
      remind_at,
      message,
      status
    )
    values (${bookingRequestId}, ${conversationId}, ${customerId}, ${new Date(Date.now() - 1000).toISOString()}, ${reminderText}, 'sending')
    returning id
  `;
  const reminderId = reminderRows[0].id;
  const reminder = await twilioClient.messages.create({
    from: businessPhone,
    to: customerPhone,
    body: reminderText,
    statusCallback: process.env.TWILIO_STATUS_CALLBACK_URL || undefined,
  });
  await sql`
    insert into messages (conversation_id, direction, body, external_id)
    values (${conversationId}, 'outbound', ${reminderText}, ${reminder.sid})
    on conflict (external_id)
    where external_id is not null
    do update set body = excluded.body
  `;
  await sql`
    update reminders
    set status = 'sent', external_id = ${reminder.sid}, sent_at = now(), last_error = null
    where id = ${reminderId}
  `;

  console.log(JSON.stringify({
    ok: true,
    runId,
    businessId,
    customerId,
    conversationId,
    bookingRequestId,
    confirmationSid: confirmation.sid,
    reminderSid: reminder.sid,
    meshTasks: [
      { task: "classify_inbound", model: modelForMeshTask("classify_inbound") },
      { task: "check_message_policy", model: modelForMeshTask("check_message_policy") },
      { task: "extract_booking_details", model: modelForMeshTask("extract_booking_details") },
    ],
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
