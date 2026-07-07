import { defineChannel, POST } from "eve/channels";

function textResponse(body: string) {
  return new Response(body, {
    headers: { "content-type": "text/plain" },
  });
}

export default defineChannel({
  routes: [
    POST("/incoming", async (req, { send }) => {
      const form = await req.formData();
      const from = String(form.get("From") ?? "");
      const body = String(form.get("Body") ?? "");

      if (!from) {
        return textResponse("");
      }

      await send(
        [
          "<whatsapp_context>",
          "channel: whatsapp",
          `from: ${from}`,
          "response_instructions: Keep replies short. Do not request payment, UPI, bank, card, Aadhaar, or PAN details.",
          "</whatsapp_context>",
          body || "Customer sent an empty WhatsApp message.",
        ].join("\n"),
        {
          auth: {
            principalId: from,
            principalType: "user",
            authenticator: "twilio-whatsapp",
            attributes: { from },
          },
          continuationToken: from,
        },
      );

      return textResponse("");
    }),
  ],
});
