import { neon } from "@neondatabase/serverless";

const required = [
  "DATABASE_URL",
  "MESH_API_KEY",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_MESSAGING_FROM",
];

const requiredTables = [
  "businesses",
  "customers",
  "conversations",
  "messages",
  "booking_requests",
  "mesh_traces",
  "owner_actions",
  "reminders",
];

function missingEnv() {
  return required.filter((name) => !process.env[name]?.trim());
}

async function main() {
  const missing = missingEnv();

  if (missing.length > 0) {
    throw new Error(`Missing required env: ${missing.join(", ")}`);
  }

  const sql = neon(process.env.DATABASE_URL);
  const rows = await sql`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
  `;
  const found = new Set(rows.map((row) => row.table_name));
  const missingTables = requiredTables.filter((table) => !found.has(table));

  if (missingTables.length > 0) {
    throw new Error(`Missing Neon tables: ${missingTables.join(", ")}. Run neon/schema.sql first.`);
  }

  const meshResponse = await fetch(`${process.env.MESH_BASE_URL ?? "https://api.meshapi.ai/v1"}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.MESH_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.MESH_FAST_MODEL ?? process.env.MESH_DEFAULT_MODEL ?? "mesh:auto",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "Return JSON only.",
        },
        {
          role: "user",
          content: "Return {\"ok\":true,\"product\":\"SlotWaala\"}.",
        },
      ],
    }),
  });

  if (!meshResponse.ok) {
    throw new Error(`Mesh preflight failed with ${meshResponse.status}: ${await meshResponse.text()}`);
  }

  console.log("SlotWaala preflight passed: env, Neon schema, and Mesh route are configured.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
