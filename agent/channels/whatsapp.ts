import { twilioChannel } from "eve/channels/twilio";
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
  async onText(_ctx, message) {
    const persisted = await persistInboundWhatsAppMessage({
      from: message.from,
      to: message.to,
      body: message.body,
      messageSid: message.messageSid,
    });

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
