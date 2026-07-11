import { createSqlClient } from "@/lib/neon/server";

function configuredWhatsAppNumber() {
  const value = process.env.TWILIO_MESSAGING_FROM?.trim();
  return value || null;
}

export async function bootstrapBusiness(name: string) {
  const businessName = name.trim();
  if (!businessName) {
    throw new Error("Business name is required.");
  }

  const sql = createSqlClient();
  const whatsappNumber = configuredWhatsAppNumber();

  if (whatsappNumber) {
    const rows = await sql`
      insert into businesses (name, whatsapp_number)
      values (${businessName}, ${whatsappNumber})
      on conflict (whatsapp_number)
      where whatsapp_number is not null
      do update set name = businesses.name
      returning id, name, whatsapp_number
    `;
    return rows[0];
  }

  const rows = await sql`
    insert into businesses (name)
    values (${businessName})
    returning id, name, whatsapp_number
  `;
  return rows[0];
}

export async function resolveBusinessId() {
  const sql = createSqlClient();
  const explicitBusinessId = process.env.SLOTWAALA_BUSINESS_ID?.trim();

  if (explicitBusinessId) {
    const rows = await sql`
      select id
      from businesses
      where id = ${explicitBusinessId}
      limit 1
    `;
    if (rows[0]) return rows[0].id as string;
  }

  const whatsappNumber = configuredWhatsAppNumber();
  if (whatsappNumber) {
    const rows = await sql`
      select id
      from businesses
      where whatsapp_number = ${whatsappNumber}
      limit 1
    `;
    if (rows[0]) return rows[0].id as string;
  }

  const rows = await sql`
    select id
    from businesses
    order by created_at asc
    limit 1
  `;
  return (rows[0]?.id as string | undefined) ?? null;
}
