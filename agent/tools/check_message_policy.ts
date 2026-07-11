import { defineTool } from "eve/tools";
import { z } from "zod";
import {
  detectSensitiveData,
  redactSensitiveData,
  sensitiveDataNotice,
} from "../../lib/sensitive-data.js";
import { createEscalation } from "../../lib/escalations.js";
import { generateMeshJson } from "../lib/mesh.js";
import { requireSlotWaalaSessionIds } from "../lib/session-context.js";
import { storeMeshTrace } from "../lib/trace-store.js";

const RawPolicySchema = z.object({
  allowedToContinue: z.boolean().optional(),
  shouldEscalate: z.boolean().optional(),
  riskLevel: z.string().optional(),
  riskReasons: z.array(z.string()).optional(),
  blockedFields: z.array(z.string()).optional(),
  ownerNote: z.string().optional(),
});

function localRisk(message: string) {
  const normalized = message.toLowerCase();
  const matches = [
    ["payment", "payment request"],
    ["upi", "UPI request"],
    ["bank", "banking request"],
    ["card", "card request"],
    ["aadhaar", "identity request"],
    ["pan", "identity request"],
    ["medical", "medical advice request"],
    ["legal", "legal advice request"],
    ["financial advice", "financial advice request"],
  ] as const;
  return matches.filter(([needle]) => normalized.includes(needle)).map(([, reason]) => reason);
}

function normalizePolicy(value: z.infer<typeof RawPolicySchema>, message: string) {
  const riskLevel = value.riskLevel === "high" || value.riskLevel === "medium" ? value.riskLevel : "low";
  const shouldEscalate = value.shouldEscalate ?? riskLevel === "high";
  const localReasons = localRisk(message);
  const escalated = shouldEscalate || localReasons.length > 0;
  return {
    allowedToContinue: value.allowedToContinue ?? !escalated,
    shouldEscalate: escalated,
    riskLevel: escalated ? "high" : riskLevel,
    riskReasons: [...new Set([...(value.riskReasons ?? []), ...localReasons])],
    blockedFields: value.blockedFields ?? [],
    ownerNote: value.ownerNote?.trim() || "No additional owner note.",
  };
}

export default defineTool({
  description:
    "Check whether a customer message is safe for SlotWaala automation or should be escalated to the owner.",
  inputSchema: z.object({
    message: z.string(),
    intent: z.string().optional(),
  }),
  execute: async (input, ctx) => {
    const sessionIds = requireSlotWaalaSessionIds(ctx);
    const categories = detectSensitiveData(input.message);

    if (categories.length > 0) {
      await createEscalation({
        businessId: sessionIds.businessId,
        customerId: sessionIds.customerId,
        conversationId: sessionIds.conversationId,
        messageId: sessionIds.messageId,
        categories,
        reason: "Sensitive payment or identity data was blocked before AI processing.",
        redactedMessage: redactSensitiveData(input.message),
        recommendedOwnerAction: "Handle this request outside SlotWaala.",
      });

      return {
        policy: {
          allowedToContinue: false,
          shouldEscalate: true,
          riskLevel: "high" as const,
          riskReasons: ["Sensitive payment or identity data was detected before model processing."],
          blockedFields: categories,
          ownerNote: sensitiveDataNotice(categories),
        },
      };
    }

    const result = await generateMeshJson<z.infer<typeof RawPolicySchema>>({
      task: "check_message_policy",
      schemaName: "MessagePolicy",
      system:
        "You are SlotWaala's safety policy checker. Detect sensitive finance/identity/payment content, medical/legal/financial advice requests, unsafe automation, and ambiguous requests. Do not extract or repeat sensitive values. Only name the category of blocked data.",
      prompt: redactSensitiveData(JSON.stringify(input)),
    });
    const policy = normalizePolicy(RawPolicySchema.parse(result.object), input.message);
    if (policy.shouldEscalate) {
      await createEscalation({
        businessId: sessionIds.businessId,
        customerId: sessionIds.customerId,
        conversationId: sessionIds.conversationId,
        messageId: sessionIds.messageId,
        categories: policy.blockedFields.length > 0 ? policy.blockedFields : ["owner_review"],
        reason: policy.riskReasons.join(" ") || "The request requires owner review before automation.",
        redactedMessage: redactSensitiveData(input.message),
        recommendedOwnerAction: policy.ownerNote,
      });
    }
    const storedTrace = await storeMeshTrace({
      trace: result.trace,
      conversationId: sessionIds.conversationId,
      messageId: sessionIds.messageId,
    });

    return {
      policy,
      meshTrace: result.trace,
      storedMeshTrace: storedTrace,
    };
  },
});
