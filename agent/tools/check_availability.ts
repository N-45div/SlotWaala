import { defineTool } from "eve/tools";
import { z } from "zod";
import { findAvailableSlots } from "../../lib/availability.js";
import { requireSlotWaalaSessionIds } from "../lib/session-context.js";

export default defineTool({
  description: "Check available owner-configured slots for a requested service.",
  inputSchema: z.object({
    service: z.string(),
    preferredWindow: z.string().optional(),
  }),
  execute: async ({ service, preferredWindow }, ctx) => {
    const sessionIds = requireSlotWaalaSessionIds(ctx);
    const availableSlots = await findAvailableSlots({
      businessId: sessionIds.businessId,
      service,
      preferredWindow,
      limit: 4,
    });

    return {
      service,
      preferredWindow: preferredWindow ?? "not specified",
      availableSlots,
      source: "configured_availability",
    };
  },
});
