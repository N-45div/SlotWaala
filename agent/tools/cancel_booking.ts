import { defineTool } from "eve/tools";
import { cancelBookingAndCreateRecoveryOffers } from "../../lib/recovery.js";
import { requireSlotWaalaSessionIds } from "../lib/session-context.js";

export default defineTool({
  description: "Cancel the latest confirmed booking in this WhatsApp conversation and create owner-reviewed recovery offers for a released slot.",
  inputSchema: {},
  execute: async (_input, ctx) => {
    const sessionIds = requireSlotWaalaSessionIds(ctx);
    return cancelBookingAndCreateRecoveryOffers({
      businessId: sessionIds.businessId,
      conversationId: sessionIds.conversationId,
    });
  },
});
