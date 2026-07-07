import { defineTool } from "eve/tools";
import { z } from "zod";
import { createBookingRequest } from "../lib/booking-store.js";

export default defineTool({
  description: "Create an owner-visible booking request from operational details.",
  inputSchema: z.object({
    customerPhone: z.string(),
    customerName: z.string().optional(),
    service: z.string().optional(),
    area: z.string().optional(),
    preferredSlot: z.string().optional(),
    missingFields: z.array(z.string()).default([]),
    lastMessage: z.string(),
  }),
  execute: async (input) => {
    const booking = await createBookingRequest({
      ...input,
      status:
        input.missingFields.length > 0 ? "needs_info" : "needs_owner_approval",
    });

    return { booking };
  },
});
