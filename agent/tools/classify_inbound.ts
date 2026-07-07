import { defineTool } from "eve/tools";
import { z } from "zod";
import { generateMeshJson } from "../lib/mesh.js";

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
});

export default defineTool({
  description: "Classify an inbound WhatsApp message and identify booking fields.",
  inputSchema: z.object({
    message: z.string(),
    from: z.string(),
  }),
  execute: async ({ message, from }) => {
    const result = await generateMeshJson<z.infer<typeof ClassificationSchema>>({
      task: "classify_inbound",
      schemaName: "Classification",
      system:
        "You classify WhatsApp messages for a service-business booking desk. Do not extract payment, bank, UPI, card, Aadhaar, or PAN details.",
      prompt: JSON.stringify({ from, message }),
    });

    return {
      classification: ClassificationSchema.parse(result.object),
      meshTrace: result.trace,
    };
  },
});
