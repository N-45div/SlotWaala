import { defineTool } from "eve/tools";
import { z } from "zod";
import { generateMeshJson } from "../lib/mesh.js";
import { requireSlotWaalaSessionIds } from "../lib/session-context.js";
import { storeMeshTrace } from "../lib/trace-store.js";

const BookingDetailsSchema = z.object({
  customerName: z.string().nullable().default(null),
  service: z.string().nullable().default(null),
  area: z.string().nullable().default(null),
  preferredSlot: z.string().nullable().default(null),
  missingFields: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  normalizedSummary: z.string(),
});

export default defineTool({
  description:
    "Extract only operational booking details from a customer WhatsApp message.",
  inputSchema: z.object({
    message: z.string(),
    intent: z.string().optional(),
  }),
  execute: async (input, ctx) => {
    const sessionIds = requireSlotWaalaSessionIds(ctx);
    const result = await generateMeshJson<z.infer<typeof BookingDetailsSchema>>({
      task: "extract_booking_details",
      schemaName: "BookingDetails",
      system:
        "Extract booking details for an Indian service business. Only extract operational fields: customer name, service, area, preferred slot, missing fields, confidence, normalized summary. Never extract payment, bank, UPI, card, Aadhaar, PAN, or sensitive financial identity values.",
      prompt: JSON.stringify(input),
    });
    const bookingDetails = BookingDetailsSchema.parse(result.object);
    const storedTrace = await storeMeshTrace({
      trace: result.trace,
      conversationId: sessionIds.conversationId,
      messageId: sessionIds.messageId,
    });

    return {
      bookingDetails,
      meshTrace: result.trace,
      storedMeshTrace: storedTrace,
    };
  },
});
