import { defineTool } from "eve/tools";
import { z } from "zod";
import { generateMeshJson } from "../lib/mesh.js";
import { requireSlotWaalaSessionIds } from "../lib/session-context.js";
import { storeMeshTrace } from "../lib/trace-store.js";

const ClassificationSchema = z.object({
  intent: z.enum([
    "booking_request",
    "reschedule",
    "cancellation",
    "pricing_question",
    "service_question",
    "complaint",
    "other",
  ]),
  language: z.string(),
  urgency: z.enum(["low", "medium", "high"]),
  sensitiveDataRisk: z.boolean(),
  summary: z.string(),
  missingFields: z.array(z.string()),
  bookingDetails: z
    .object({
      customerName: z.string().nullable().default(null),
      service: z.string().nullable().default(null),
      area: z.string().nullable().default(null),
      preferredSlot: z.string().nullable().default(null),
    })
    .default({
      customerName: null,
      service: null,
      area: null,
      preferredSlot: null,
    }),
});

export default defineTool({
  description: "Classify an inbound WhatsApp message and identify booking fields.",
  inputSchema: z.object({
    message: z.string(),
    from: z.string(),
  }),
  execute: async ({ message, from }, ctx) => {
    const sessionIds = requireSlotWaalaSessionIds(ctx);
    const result = await generateMeshJson<z.infer<typeof ClassificationSchema>>({
      task: "classify_inbound",
      schemaName: "Classification",
      system:
        "You classify WhatsApp messages for a service-business booking desk. Extract only operational booking fields: customer name, service, area, preferred slot, missing fields. Do not extract payment, bank, UPI, card, Aadhaar, or PAN details.",
      prompt: JSON.stringify({ from, message }),
    });
    const classification = ClassificationSchema.parse(result.object);
    const storedTrace = await storeMeshTrace({
      trace: result.trace,
      conversationId: sessionIds.conversationId,
      messageId: sessionIds.messageId,
    });

    return {
      classification,
      meshTrace: result.trace,
      storedMeshTrace: storedTrace,
    };
  },
});
