import { defineTool } from "eve/tools";
import { z } from "zod";
import { holdSlotForBooking } from "../../lib/availability.js";
import { createBookingRequest } from "../lib/booking-store.js";
import { requireSlotWaalaSessionIds } from "../lib/session-context.js";
import { toJsonSafe } from "../lib/json-safe.js";

export default defineTool({
  description: "Create an owner-visible booking request from operational details.",
  inputSchema: z.object({
    customerName: z.string().optional(),
    service: z.string().optional(),
    area: z.string().optional(),
    preferredSlot: z.string().optional(),
    missingFields: z.array(z.string()).default([]),
    agentDraft: z.string().optional(),
    meshTraceId: z.string().optional(),
    proposedSlot: z
      .object({
        startsAt: z.string(),
        endsAt: z.string(),
      })
      .optional(),
  }),
  execute: async (input, ctx) => {
    const sessionIds = requireSlotWaalaSessionIds(ctx);
    const booking = await createBookingRequest({
      businessId: sessionIds.businessId,
      customerId: sessionIds.customerId,
      conversationId: sessionIds.conversationId,
      service: input.service,
      area: input.area,
      preferredSlot: input.proposedSlot?.startsAt ?? input.preferredSlot,
      missingFields: input.missingFields,
      agentDraft: input.agentDraft,
      meshTraceId: input.meshTraceId,
      status:
        input.missingFields.length > 0 ? "needs_info" : "needs_owner_approval",
    });

    const slotHold = input.proposedSlot
      ? await holdSlotForBooking({
          businessId: sessionIds.businessId,
          bookingRequestId: booking.id,
          startsAt: input.proposedSlot.startsAt,
          endsAt: input.proposedSlot.endsAt,
        })
      : null;

    return toJsonSafe({ booking, slotHold });
  },
});
