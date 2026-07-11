import { twilioChannel } from "eve/channels/twilio";
import { createEscalation } from "../../lib/escalations.js";
import {
  detectSensitiveData,
  redactSensitiveData,
  sensitiveDataNotice,
} from "../../lib/sensitive-data.js";
import { persistInboundWhatsAppMessage } from "../lib/intake-store.js";

function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export default twilioChannel({
  allowFrom: env("TWILIO_ALLOW_FROM") ?? "*",
  webhookUrl: env("TWILIO_WHATSAPP_WEBHOOK_URL"),
  publicBaseUrl: env("NEXT_PUBLIC_APP_URL"),
  messaging: {
    from: env("TWILIO_MESSAGING_FROM"),
    statusCallbackUrl: env("TWILIO_STATUS_CALLBACK_URL"),
  },
  events: {
    // A failed model turn is parked for retry by Eve. Re-key it so the next
    // inbound WhatsApp message starts cleanly instead of replaying the same
    // broken tool-call stream forever.
    "turn.failed": (_data, channel) => {
      channel.setContinuationToken(`recovery-${crypto.randomUUID()}`);
    },
    "session.failed": (_data, channel) => {
      channel.setContinuationToken(`recovery-${crypto.randomUUID()}`);
    },
  },
  async onText(_ctx, message) {
    const categories = detectSensitiveData(message.body);
    const redactedBody = categories.length > 0
      ? sensitiveDataNotice(categories)
      : message.body;
    const persisted = await persistInboundWhatsAppMessage({
      from: message.from,
      to: message.to,
      body: redactedBody,
      messageSid: message.messageSid,
    });

    if (categories.length > 0) {
      await createEscalation({
        businessId: persisted.business.id,
        customerId: persisted.customer.id,
        conversationId: persisted.conversation.id,
        messageId: persisted.message.id,
        categories,
        reason: "Sensitive payment or identity data was blocked before AI processing.",
        redactedMessage: redactSensitiveData(message.body),
        recommendedOwnerAction: "Handle this request outside SlotWaala and do not ask the customer to resend sensitive data.",
      });

      // Eve drops the message when onText returns null, so no model receives its raw content.
      return null;
    }

    return {
      auth: {
        principalId: message.from,
        principalType: "user",
        authenticator: "twilio-whatsapp",
        attributes: {
          from: message.from,
          to: message.to ?? "",
          businessId: persisted.business.id,
          customerId: persisted.customer.id,
          conversationId: persisted.conversation.id,
          messageId: persisted.message.id,
        },
      },
    };
  },
});
