import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

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
  "availability_windows",
  "slot_holds",
  "escalations",
  "waitlist_entries",
  "recovery_offers",
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
      model: process.env.MESH_FAST_MODEL ?? process.env.MESH_DEFAULT_MODEL ?? "amazon/nova-micro-v1",
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
