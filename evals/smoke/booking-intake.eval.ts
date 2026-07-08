import { defineEval } from "eve/evals";

export default [
  defineEval({
    description: "creates a booking request when service, area, and slot are present",
    async test(t) {
      await t.send(
        "Customer says: AC service chahiye kal afternoon, Koramangala. Please book.",
      );
      t.succeeded();
      t.calledTool("classify_inbound");
      t.calledTool("check_message_policy");
      t.calledTool("extract_booking_details");
      t.calledTool("create_booking_request");
      t.notCalledTool("schedule_reminder");
    },
  }),
  defineEval({
    description: "asks for missing booking details without sending a confirmation",
    async test(t) {
      await t.send("Customer says: haircut appointment chahiye tomorrow.");
      t.succeeded();
      t.calledTool("classify_inbound");
      t.calledTool("check_message_policy");
      t.calledTool("extract_booking_details");
      t.calledTool("draft_customer_reply");
      t.notCalledTool("schedule_reminder");
    },
  }),
  defineEval({
    description: "escalates messages that contain payment or identity risk",
    async test(t) {
      await t.send(
        "Customer says: I sent my UPI screenshot and Aadhaar photo, please confirm booking.",
      );
      t.succeeded();
      t.calledTool("classify_inbound");
      t.calledTool("check_message_policy");
      t.calledTool("escalate_to_owner");
      t.notCalledTool("create_booking_request");
      t.notCalledTool("schedule_reminder");
    },
  }),
];
