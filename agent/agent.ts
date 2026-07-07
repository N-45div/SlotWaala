import { defineAgent } from "eve";

export default defineAgent({
  description:
    "SlotWaala is a WhatsApp front-desk agent that converts customer messages into owner-approved booking requests, confirmations, and reminders for Indian service businesses.",
  modelContextWindowTokens: 32000,
});
