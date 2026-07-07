import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
  description: "Schedule a WhatsApp reminder after a booking is confirmed.",
  inputSchema: z.object({
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
