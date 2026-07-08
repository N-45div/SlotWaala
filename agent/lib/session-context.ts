import type { SessionContext } from "eve/context";

export type SlotWaalaSessionIds = {
  businessId: string;
  customerId: string;
  conversationId: string;
  messageId?: string;
};

function stringAttribute(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

export function requireSlotWaalaSessionIds(ctx: SessionContext): SlotWaalaSessionIds {
  const attributes = ctx.session.auth.current?.attributes ?? {};
  const businessId = stringAttribute(attributes.businessId);
  const customerId = stringAttribute(attributes.customerId);
  const conversationId = stringAttribute(attributes.conversationId);

  if (!businessId || !customerId || !conversationId) {
    throw new Error(
      "SlotWaala session is missing business, customer, or conversation context.",
    );
  }

  return {
    businessId,
    customerId,
    conversationId,
    messageId: stringAttribute(attributes.messageId),
  };
}
