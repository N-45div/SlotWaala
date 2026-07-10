import { defineTool } from "eve/tools";
import { z } from "zod";
import { redactSensitiveData } from "../../lib/sensitive-data.js";
import { generateMeshJson } from "../lib/mesh.js";
import { requireSlotWaalaSessionIds } from "../lib/session-context.js";
import { storeMeshTrace } from "../lib/trace-store.js";

const DraftSchema = z.object({
  reply: z.string(),
  tone: z.string(),
  requiresOwnerApproval: z.boolean(),
  reason: z.string(),
});

export default defineTool({
  description: "Draft a short WhatsApp reply for the customer.",
  inputSchema: z.object({
    customerMessage: z.string(),
    businessContext: z.string(),
    proposedAction: z.string(),
    bookingRequestId: z.string().optional(),
  }),
  execute: async (input, ctx) => {
    const sessionIds = requireSlotWaalaSessionIds(ctx);
    const result = await generateMeshJson<z.infer<typeof DraftSchema>>({
      task: "draft_customer_reply",
      schemaName: "CustomerReplyDraft",
      system:
        "Draft concise WhatsApp replies for Indian service businesses. Never ask for payment details. Mark owner approval required for confirmations.",
      prompt: redactSensitiveData(JSON.stringify(input)),
    });
    const storedTrace = await storeMeshTrace({
      trace: result.trace,
      bookingRequestId: input.bookingRequestId,
      conversationId: sessionIds.conversationId,
      messageId: sessionIds.messageId,
    });

    return {
      draft: DraftSchema.parse(result.object),
      meshTrace: result.trace,
      storedMeshTrace: storedTrace,
    };
  },
});
