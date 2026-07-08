import { createSqlClient } from "../../lib/neon/server.js";

type BusinessRow = {
  id: string;
  name: string;
  whatsapp_number: string | null;
  created_at: string;
};

type CustomerRow = {
  id: string;
  business_id: string;
  display_name: string | null;
  phone: string;
  created_at: string;
};

type ConversationRow = {
  id: string;
  business_id: string;
  customer_id: string;
  channel: "whatsapp" | "sms" | "email";
  status: "open" | "closed";
  created_at: string;
  updated_at: string;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  direction: "inbound" | "outbound";
  body: string;
  external_id: string | null;
  created_at: string;
};

export type PersistedInboundMessage = {
  business: BusinessRow;
  customer: CustomerRow;
  conversation: ConversationRow;
  message: MessageRow;
};

export type InboundWhatsAppMessage = {
  from: string;
  to?: string;
  body: string;
  messageSid?: string;
};

function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

async function getBusiness(input: {
  to?: string;
}): Promise<BusinessRow> {
  const sql = createSqlClient();
  const explicitBusinessId = env("SLOTWAALA_BUSINESS_ID");

  if (explicitBusinessId) {
    const rows = await sql`
      select id, name, whatsapp_number, created_at
      from businesses
      where id = ${explicitBusinessId}
      limit 1
    `;
    const business = rows[0] as BusinessRow | undefined;
    if (business) return business;
  }

  const whatsappNumber = input.to ?? env("TWILIO_MESSAGING_FROM") ?? null;
  const businessName = env("SLOTWAALA_BUSINESS_NAME") ?? "SlotWaala Demo Business";

  if (whatsappNumber) {
    const rows = await sql`
      insert into businesses (name, whatsapp_number)
      values (${businessName}, ${whatsappNumber})
      on conflict (whatsapp_number)
      where whatsapp_number is not null
      do update set name = excluded.name
      returning id, name, whatsapp_number, created_at
    `;
    return rows[0] as BusinessRow;
  }

  const rows = await sql`
    insert into businesses (name)
    values (${businessName})
    returning id, name, whatsapp_number, created_at
  `;
  return rows[0] as BusinessRow;
}

async function upsertCustomer(input: {
  businessId: string;
  phone: string;
}): Promise<CustomerRow> {
  const sql = createSqlClient();
  const rows = await sql`
    insert into customers (business_id, phone)
    values (${input.businessId}, ${input.phone})
    on conflict (business_id, phone)
    do update set phone = excluded.phone
    returning id, business_id, display_name, phone, created_at
  `;
  return rows[0] as CustomerRow;
}

async function openConversation(input: {
  businessId: string;
  customerId: string;
}): Promise<ConversationRow> {
  const sql = createSqlClient();
  const existing = await sql`
    select id, business_id, customer_id, channel, status, created_at, updated_at
    from conversations
    where business_id = ${input.businessId}
      and customer_id = ${input.customerId}
      and channel = 'whatsapp'
      and status = 'open'
    order by updated_at desc
    limit 1
  `;
  const conversation = existing[0] as ConversationRow | undefined;

  if (conversation) {
    const rows = await sql`
      update conversations
      set updated_at = now()
      where id = ${conversation.id}
      returning id, business_id, customer_id, channel, status, created_at, updated_at
    `;
    return rows[0] as ConversationRow;
  }

  const rows = await sql`
    insert into conversations (business_id, customer_id, channel)
    values (${input.businessId}, ${input.customerId}, 'whatsapp')
    returning id, business_id, customer_id, channel, status, created_at, updated_at
  `;
  return rows[0] as ConversationRow;
}

async function storeInboundMessage(input: {
  conversationId: string;
  body: string;
  messageSid?: string;
}): Promise<MessageRow> {
  const sql = createSqlClient();
  const rows = await sql`
    insert into messages (conversation_id, direction, body, external_id)
    values (
      ${input.conversationId},
      'inbound',
      ${input.body},
      ${input.messageSid ?? null}
    )
    on conflict (external_id)
    where external_id is not null
    do update set body = excluded.body
    returning id, conversation_id, direction, body, external_id, created_at
  `;
  return rows[0] as MessageRow;
}

export async function persistInboundWhatsAppMessage(
  input: InboundWhatsAppMessage,
): Promise<PersistedInboundMessage> {
  const business = await getBusiness({ to: input.to });
  const customer = await upsertCustomer({
    businessId: business.id,
    phone: input.from,
  });
  const conversation = await openConversation({
    businessId: business.id,
    customerId: customer.id,
  });
  const message = await storeInboundMessage({
    conversationId: conversation.id,
    body: input.body || "Customer sent an empty WhatsApp message.",
    messageSid: input.messageSid,
  });

  return {
    business,
    customer,
    conversation,
    message,
  };
}
