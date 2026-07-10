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

const PolicySchema = z.object({
  allowedToContinue: z.boolean(),
  shouldEscalate: z.boolean(),
  riskLevel: z.enum(["low", "medium", "high"]),
  riskReasons: z.array(z.string()),
  blockedFields: z.array(z.string()),
  ownerNote: z.string(),
});

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

    const result = await generateMeshJson<z.infer<typeof PolicySchema>>({
      task: "check_message_policy",
      schemaName: "MessagePolicy",
      system:
        "You are SlotWaala's safety policy checker. Detect sensitive finance/identity/payment content, medical/legal/financial advice requests, unsafe automation, and ambiguous requests. Do not extract or repeat sensitive values. Only name the category of blocked data.",
      prompt: redactSensitiveData(JSON.stringify(input)),
    });
    const policy = PolicySchema.parse(result.object);
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
