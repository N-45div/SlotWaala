import twilio from "twilio";

type TwilioParams = Record<string, string>;

function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export function formDataToTwilioParams(form: FormData): TwilioParams {
  const params: TwilioParams = {};

  for (const [key, value] of form.entries()) {
    if (typeof value === "string") {
      params[key] = value;
    }
  }

  return params;
}

export function verifyTwilioWebhook(req: Request, params: TwilioParams): boolean {
  const authToken = env("TWILIO_AUTH_TOKEN");
  const signature = req.headers.get("x-twilio-signature") ?? "";

  if (!authToken) {
    return process.env.NODE_ENV !== "production";
  }

  if (!signature) {
    return false;
  }

  const webhookUrl = env("TWILIO_WHATSAPP_WEBHOOK_URL") ?? req.url;
  return twilio.validateRequest(authToken, signature, webhookUrl, params);
}

export function isAllowedSender(from: string): boolean {
  const allowFrom = env("TWILIO_ALLOW_FROM");

  if (!allowFrom || allowFrom === "*") {
    return true;
  }

  return allowFrom
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .includes(from);
}
