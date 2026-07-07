import { neon } from "@neondatabase/serverless";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required for Neon persistence.`);
  }

  return value;
}

export function createSqlClient() {
  return neon(requireEnv("DATABASE_URL"));
}
