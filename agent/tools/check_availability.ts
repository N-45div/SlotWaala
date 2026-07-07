import { tool } from "eve";
import { z } from "zod";

const sampleSlots = [
  "Today 6:15 PM",
  "Tomorrow 11:30 AM",
  "Tomorrow 4:00 PM",
  "Friday 7:00 PM",
];

export default tool({
  description: "Check available owner-configured slots for a requested service.",
  parameters: z.object({
    service: z.string(),
    preferredWindow: z.string().optional(),
  }),
  execute: async ({ service, preferredWindow }) => {
    return {
      service,
      preferredWindow: preferredWindow ?? "not specified",
      availableSlots: sampleSlots,
      source: "demo_calendar",
    };
  },
});
