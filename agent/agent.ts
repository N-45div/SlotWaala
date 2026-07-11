import { createOpenAI } from "@ai-sdk/openai";
import { defineAgent } from "eve";

function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

const mesh = createOpenAI({
  name: "mesh",
  baseURL: (env("MESH_BASE_URL") ?? "https://api.meshapi.ai/v1").replace(
    /\/$/,
    "",
  ),
  apiKey: env("MESH_API_KEY"),
});

export default defineAgent({
  model: mesh.chat(
    env("MESH_AGENT_MODEL") ??
      env("MESH_DEFAULT_MODEL") ??
      "anthropic/claude-haiku-4.5",
  ),
  description:
    "SlotWaala is a WhatsApp front-desk agent that converts customer messages into owner-approved booking requests, confirmations, and reminders for Indian service businesses.",
  modelContextWindowTokens: 32000,
});
