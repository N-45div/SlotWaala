import { defineEval } from "eve/evals";

export default defineEval({
  async test(t) {
    await t.send(
      "Customer says: AC service chahiye kal afternoon, Koramangala. Please book.",
    );
    t.succeeded();
    t.notCalledTool("schedule_reminder");
  },
});
