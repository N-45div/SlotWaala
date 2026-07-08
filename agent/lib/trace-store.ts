import type { MeshTrace } from "./mesh.js";
import { createSqlClient } from "../../lib/neon/server.js";

export type StoredMeshTrace = {
  id: string;
  booking_request_id: string | null;
  conversation_id: string | null;
  message_id: string | null;
  task: string;
  model: string;
  latency_ms: number;
  input_summary: string;
  output_summary: string;
  created_at: string;
};

export async function storeMeshTrace(input: {
  trace: MeshTrace;
  bookingRequestId?: string;
  conversationId?: string;
  messageId?: string;
}): Promise<StoredMeshTrace> {
  const sql = createSqlClient();
  const rows = await sql`
    insert into mesh_traces (
      booking_request_id,
      conversation_id,
      message_id,
      task,
      model,
      latency_ms,
      input_summary,
      output_summary
    )
    values (
      ${input.bookingRequestId ?? null},
      ${input.conversationId ?? null},
      ${input.messageId ?? null},
      ${input.trace.task},
      ${input.trace.model},
      ${input.trace.latencyMs},
      ${input.trace.inputSummary},
      ${input.trace.outputSummary}
    )
    returning
      id,
      booking_request_id,
      conversation_id,
      message_id,
      task,
      model,
      latency_ms,
      input_summary,
      output_summary,
      created_at
  `;

  return rows[0] as StoredMeshTrace;
}

export async function attachTraceToBooking(input: {
  traceId: string;
  bookingRequestId: string;
}): Promise<void> {
  const sql = createSqlClient();
  await sql`
    update mesh_traces
    set booking_request_id = ${input.bookingRequestId}
    where id = ${input.traceId}
  `;
}
