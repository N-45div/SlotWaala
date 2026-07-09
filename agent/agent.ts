import { defineAgent } from "eve";

export default defineAgent({
  model: process.env.MESH_AGENT_MODEL ?? process.env.MESH_DEFAULT_MODEL ?? "amazon/nova-lite-v1",
  description:
    "SlotWaala is a WhatsApp front-desk agent that converts customer messages into owner-approved booking requests, confirmations, and reminders for Indian service businesses.",
  modelContextWindowTokens: 32000,
});
