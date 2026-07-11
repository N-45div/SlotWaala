import { defineTool } from "eve/tools";
import { z } from "zod";
import { joinWaitlist } from "../../lib/recovery.js";
import { toJsonSafe } from "../lib/json-safe.js";
import { requireSlotWaalaSessionIds } from "../lib/session-context.js";

export default defineTool({
  description: "Add a customer to the persisted waitlist when no configured slot is available.",
  inputSchema: z.object({
    service: z.string().optional(),
    preferredWindow: z.string().optional(),
  }),
  execute: async (input, ctx) => {
    const sessionIds = requireSlotWaalaSessionIds(ctx);
    const entry = await joinWaitlist({
      businessId: sessionIds.businessId,
      customerId: sessionIds.customerId,
      conversationId: sessionIds.conversationId,
      service: input.service,
      preferredWindow: input.preferredWindow,
    });

    return toJsonSafe({ waitlistEntry: entry });
  },
});
