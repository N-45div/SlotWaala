import { tool } from "eve";
import { z } from "zod";
import { generateMeshJson } from "../lib/mesh.js";

const DraftSchema = z.object({
  reply: z.string(),
  tone: z.string(),
  requiresOwnerApproval: z.boolean(),
  reason: z.string(),
});

export default tool({
  description: "Draft a short WhatsApp reply for the customer.",
  parameters: z.object({
    customerMessage: z.string(),
    businessContext: z.string(),
    proposedAction: z.string(),
  }),
  execute: async (input) => {
    const result = await generateMeshJson<z.infer<typeof DraftSchema>>({
      task: "draft_customer_reply",
      schemaName: "CustomerReplyDraft",
      system:
        "Draft concise WhatsApp replies for Indian service businesses. Never ask for payment details. Mark owner approval required for confirmations.",
      prompt: JSON.stringify(input),
    });

    return {
      draft: DraftSchema.parse(result.object),
      meshTrace: result.trace,
    };
  },
});
