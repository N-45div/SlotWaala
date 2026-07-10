import { defineTool } from "eve/tools";
import { acceptRecoveryOfferForConversation } from "../../lib/recovery.js";
import { requireSlotWaalaSessionIds } from "../lib/session-context.js";

export default defineTool({
  description: "Accept the active recovery offer when the waiting customer explicitly says yes, then create an owner-review booking hold.",
  inputSchema: {},
  execute: async (_input, ctx) => {
    const sessionIds = requireSlotWaalaSessionIds(ctx);
    return acceptRecoveryOfferForConversation({
      businessId: sessionIds.businessId,
      customerId: sessionIds.customerId,
      conversationId: sessionIds.conversationId,
    });
  },
});
