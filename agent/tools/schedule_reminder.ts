import { tool } from "eve";
import { z } from "zod";

export default tool({
  description: "Schedule a WhatsApp reminder after a booking is confirmed.",
  parameters: z.object({
    bookingId: z.string(),
    customerPhone: z.string(),
    reminderAt: z.string(),
    message: z.string(),
  }),
  execute: async (input) => {
    return {
      reminder: {
        ...input,
        id: `rem_${Math.random().toString(36).slice(2, 10)}`,
        status: "scheduled",
      },
    };
  },
});
