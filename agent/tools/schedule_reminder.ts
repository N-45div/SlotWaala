import { defineTool } from "eve/tools";
import { z } from "zod";
import { scheduleBookingReminder } from "../../lib/reminders.js";

export default defineTool({
  description: "Schedule a WhatsApp reminder after a booking is confirmed.",
  inputSchema: z.object({
    bookingRequestId: z.string(),
    reminderAt: z.string().optional(),
    message: z.string().optional(),
  }),
  execute: async (input) => {
    const reminder = await scheduleBookingReminder(input);

    return {
      reminder,
    };
  },
});
