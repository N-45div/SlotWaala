import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
  description: "Escalate unclear, sensitive, or risky messages to the business owner.",
  inputSchema: z.object({
    from: z.string(),
    reason: z.string(),
    message: z.string(),
    recommendedOwnerAction: z.string(),
  }),
  execute: async (input) => {
    return {
      escalation: {
        ...input,
        id: `esc_${Math.random().toString(36).slice(2, 10)}`,
        status: "open",
        createdAt: new Date().toISOString(),
      },
    };
  },
});
