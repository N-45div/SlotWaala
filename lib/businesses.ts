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
