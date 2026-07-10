import { defineTool } from "eve/tools";
import { z } from "zod";
import { createEscalation } from "../../lib/escalations.js";
import { redactSensitiveData } from "../../lib/sensitive-data.js";
import { requireSlotWaalaSessionIds } from "../lib/session-context.js";

export default defineTool({
  description: "Escalate unclear, sensitive, or risky messages to the business owner.",
  inputSchema: z.object({
    from: z.string(),
    reason: z.string(),
    message: z.string(),
    recommendedOwnerAction: z.string(),
  }),
  execute: async (input, ctx) => {
    const sessionIds = requireSlotWaalaSessionIds(ctx);
    const escalation = await createEscalation({
      businessId: sessionIds.businessId,
      customerId: sessionIds.customerId,
      conversationId: sessionIds.conversationId,
      messageId: sessionIds.messageId,
      reason: input.reason,
      redactedMessage: redactSensitiveData(input.message),
      recommendedOwnerAction: input.recommendedOwnerAction,
    });

    return {
      escalation,
    };
  },
});
