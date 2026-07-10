import { createSqlClient } from "@/lib/neon/server";
import type { SensitiveDataCategory } from "@/lib/sensitive-data";

export type Escalation = {
  id: string;
  businessId: string;
  customerId: string | null;
  conversationId: string | null;
  messageId: string | null;
  status: "open" | "resolved";
  categories: string[];
  reason: string;
  redactedMessage: string;
  recommendedOwnerAction: string | null;
  createdAt: string;
};

type EscalationRow = {
  id: string;
  business_id: string;
  customer_id: string | null;
  conversation_id: string | null;
  message_id: string | null;
  status: "open" | "resolved";
  categories: string[];
  reason: string;
  redacted_message: string;
  recommended_owner_action: string | null;
  created_at: string;
};

function mapEscalation(row: EscalationRow): Escalation {
  return {
    id: row.id,
    businessId: row.business_id,
    customerId: row.customer_id,
    conversationId: row.conversation_id,
    messageId: row.message_id,
    status: row.status,
    categories: row.categories,
    reason: row.reason,
    redactedMessage: row.redacted_message,
    recommendedOwnerAction: row.recommended_owner_action,
    createdAt: row.created_at,
  };
}

export async function createEscalation(input: {
  businessId: string;
  customerId?: string;
  conversationId?: string;
  messageId?: string;
  categories?: SensitiveDataCategory[] | string[];
  reason: string;
  redactedMessage: string;
  recommendedOwnerAction?: string;
}): Promise<Escalation> {
  const sql = createSqlClient();
  const rows = (await sql`
    insert into escalations (
      business_id,
      customer_id,
      conversation_id,
      message_id,
      categories,
      reason,
      redacted_message,
      recommended_owner_action
    )
    values (
      ${input.businessId},
      ${input.customerId ?? null},
      ${input.conversationId ?? null},
      ${input.messageId ?? null},
      ${input.categories ?? []},
      ${input.reason},
      ${input.redactedMessage},
      ${input.recommendedOwnerAction ?? null}
    )
    returning
      id,
      business_id,
      customer_id,
      conversation_id,
      message_id,
      status,
      categories,
      reason,
      redacted_message,
      recommended_owner_action,
      created_at
  `) as EscalationRow[];

  return mapEscalation(rows[0]);
}

export async function resolveEscalation(escalationId: string) {
  const sql = createSqlClient();
  await sql`
    update escalations
    set status = 'resolved', resolved_at = now()
    where id = ${escalationId}
      and status = 'open'
  `;
}
