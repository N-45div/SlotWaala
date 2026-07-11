import { defineTool } from "eve/tools";
import { z } from "zod";
import { redactSensitiveData } from "../../lib/sensitive-data.js";
import { generateMeshJson } from "../lib/mesh.js";
import { requireSlotWaalaSessionIds } from "../lib/session-context.js";
import { storeMeshTrace } from "../lib/trace-store.js";

const RawBookingDetailsSchema = z.object({
  customerName: z.string().nullable().optional(),
  service: z.string().nullable().optional(),
  area: z.string().nullable().optional(),
  preferredSlot: z.string().nullable().optional(),
  missingFields: z.array(z.string()).optional(),
  confidence: z.coerce.number().min(0).max(1).optional(),
  normalizedSummary: z.string().optional(),
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
    const result = await generateMeshJson<z.infer<typeof RawBookingDetailsSchema>>({
      task: "extract_booking_details",
      schemaName: "BookingDetails",
      system:
        "Extract booking details for an Indian service business. Only extract operational fields: customer name, service, area, preferred slot, missing fields, confidence, normalized summary. Never extract payment, bank, UPI, card, Aadhaar, PAN, or sensitive financial identity values.",
      prompt: redactSensitiveData(JSON.stringify(input)),
    });
    const raw = RawBookingDetailsSchema.parse(result.object);
    const bookingDetails = {
      customerName: raw.customerName ?? null,
      service: raw.service ?? null,
      area: raw.area ?? null,
      preferredSlot: raw.preferredSlot ?? null,
      missingFields: raw.missingFields ?? [],
      confidence: raw.confidence ?? 0,
      normalizedSummary: raw.normalizedSummary?.trim() || "Operational booking details extracted from the customer message.",
    };
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
