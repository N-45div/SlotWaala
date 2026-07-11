import { defineTool } from "eve/tools";
import { z } from "zod";
import { redactSensitiveData } from "../../lib/sensitive-data.js";
import { generateMeshJson } from "../lib/mesh.js";
import { requireSlotWaalaSessionIds } from "../lib/session-context.js";
import { storeMeshTrace } from "../lib/trace-store.js";

const IntentSchema = z.enum([
  "booking_request",
  "reschedule",
  "cancellation",
  "pricing_question",
  "service_question",
  "complaint",
  "other",
]);

const RawClassificationSchema = z.object({
  intent: z.string().optional(),
  language: z.string().optional(),
  urgency: z.string().optional(),
  sensitiveDataRisk: z.boolean().optional(),
  summary: z.string().optional(),
  shouldExtractBookingDetails: z.boolean().optional(),
});

type Classification = {
  intent: z.infer<typeof IntentSchema>;
  language: string;
  urgency: "low" | "medium" | "high";
  sensitiveDataRisk: boolean;
  summary: string;
  shouldExtractBookingDetails: boolean;
};

function normalizeClassification(
  value: z.infer<typeof RawClassificationSchema>,
  message: string,
): Classification {
  const source = `${value.intent ?? ""} ${message}`.toLowerCase();
  let intent: Classification["intent"] = "other";

  if (source.includes("cancel")) intent = "cancellation";
  else if (source.includes("reschedul") || source.includes("change time")) intent = "reschedule";
  else if (source.includes("price") || source.includes("cost") || source.includes("rate")) intent = "pricing_question";
  else if (source.includes("complaint") || source.includes("angry") || source.includes("problem")) intent = "complaint";
  else if (
    source.includes("book") ||
    source.includes("appointment") ||
    source.includes("schedule") ||
    source.includes("service chahiye") ||
    source.includes("please book")
  ) intent = "booking_request";
  else if (source.includes("service") || source.includes("what do you offer")) intent = "service_question";

  const urgency = value.urgency === "high" || value.urgency === "low" ? value.urgency : "medium";
  const shouldExtract = value.shouldExtractBookingDetails ?? [
    "booking_request",
    "reschedule",
    "cancellation",
    "pricing_question",
    "service_question",
  ].includes(intent);

  return {
    intent,
    language: value.language?.trim() || "unknown",
    urgency,
    sensitiveDataRisk: value.sensitiveDataRisk ?? false,
    summary: value.summary?.trim() || message.slice(0, 180),
    shouldExtractBookingDetails: shouldExtract,
  };
}

export default defineTool({
  description: "Classify an inbound WhatsApp message and identify booking fields.",
  inputSchema: z.object({
    message: z.string(),
    from: z.string(),
  }),
  execute: async ({ message, from }, ctx) => {
    const sessionIds = requireSlotWaalaSessionIds(ctx);
    const result = await generateMeshJson<z.infer<typeof RawClassificationSchema>>({
      task: "classify_inbound",
      schemaName: "Classification",
      system:
        "You classify WhatsApp messages for a service-business booking desk. Return intent, language, urgency, sensitive-data risk, a short summary, and whether the message needs booking-detail extraction. Do not extract payment, bank, UPI, card, Aadhaar, or PAN details.",
      prompt: JSON.stringify({ from, message: redactSensitiveData(message) }),
    });
    const classification = normalizeClassification(
      RawClassificationSchema.parse(result.object),
      message,
    );
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
