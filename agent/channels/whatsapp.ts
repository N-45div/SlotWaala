import { defineChannel, POST } from "eve/channels";
import { persistInboundWhatsAppMessage } from "../lib/intake-store.js";
import {
  formDataToTwilioParams,
  isAllowedSender,
  verifyTwilioWebhook,
} from "../lib/twilio-webhook.js";

function textResponse(body: string) {
  return new Response(body, {
    headers: { "content-type": "text/plain" },
  });
}

export default defineChannel({
  routes: [
    POST("/incoming", async (req, { send }) => {
      const form = await req.formData();
      const params = formDataToTwilioParams(form);
      const from = params.From?.trim() ?? "";
      const to = params.To?.trim();
      const body = params.Body?.trim() ?? "";
      const messageSid = params.MessageSid ?? params.SmsMessageSid;

      if (!from) {
        return textResponse("");
      }

      if (!isAllowedSender(from)) {
        return textResponse("");
      }

      if (!verifyTwilioWebhook(req, params)) {
        return new Response("invalid twilio signature", { status: 401 });
      }

      const persisted = await persistInboundWhatsAppMessage({
        from,
        to,
        body,
        messageSid,
      });

      await send(
        [
          "<whatsapp_context>",
          "channel: whatsapp",
          `from: ${from}`,
          to ? `to: ${to}` : "",
          messageSid ? `message_sid: ${messageSid}` : "",
          `business_id: ${persisted.business.id}`,
          `customer_id: ${persisted.customer.id}`,
          `conversation_id: ${persisted.conversation.id}`,
          `message_id: ${persisted.message.id}`,
          "response_instructions: Keep replies short. Do not request payment, UPI, bank, card, Aadhaar, or PAN details.",
          "</whatsapp_context>",
          body || "Customer sent an empty WhatsApp message.",
        ]
          .filter(Boolean)
          .join("\n"),
        {
          auth: {
            principalId: from,
            principalType: "user",
            authenticator: "twilio-whatsapp",
            attributes: {
              from,
              to: to ?? "",
              businessId: persisted.business.id,
              customerId: persisted.customer.id,
              conversationId: persisted.conversation.id,
              messageId: persisted.message.id,
            },
          },
          continuationToken: `${persisted.business.id}:${from}`,
        },
      );

      return textResponse("");
    }),
  ],
});
