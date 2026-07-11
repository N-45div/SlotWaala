import { defineTool } from "eve/tools";
import { z } from "zod";
import { redactSensitiveData } from "../../lib/sensitive-data.js";
import { generateMeshJson } from "../lib/mesh.js";
import { requireSlotWaalaSessionIds } from "../lib/session-context.js";
import { storeMeshTrace } from "../lib/trace-store.js";

const RawDraftSchema = z.object({
  reply: z.string().optional(),
  message: z.string().optional(),
  tone: z.string().optional(),
  requiresOwnerApproval: z.boolean().optional(),
  requires_owner_approval: z.boolean().optional(),
  reason: z.string().optional(),
  proposedAction: z.string().optional(),
});

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

    const raw = RawDraftSchema.parse(result.object);
    const draft = DraftSchema.parse({
      reply: raw.reply?.trim() || raw.message?.trim() || "Thanks. We have received your request and will review the slot.",
      tone: raw.tone?.trim() || "friendly",
      requiresOwnerApproval: raw.requiresOwnerApproval ?? raw.requires_owner_approval ?? true,
      reason: raw.reason?.trim() || raw.proposedAction?.trim() || "Owner approval is required before confirmation.",
    });

    return {
      draft,
      meshTrace: result.trace,
      storedMeshTrace: storedTrace,
    };
  },
});
