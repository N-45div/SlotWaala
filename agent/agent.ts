import { defineAgent } from "eve";

export default defineAgent({
  model: process.env.MESH_AGENT_MODEL ?? "openai/gpt-4o-mini",
  description:
    "SlotWaala is a WhatsApp front-desk agent that converts customer messages into owner-approved booking requests, confirmations, and reminders for Indian service businesses.",
  modelContextWindowTokens: 32000,
});
