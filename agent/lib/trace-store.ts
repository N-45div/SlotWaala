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

  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row) {
    throw new Error("Mesh trace insert did not return a row.");
  }

  // Neon returns timestamp columns as Date objects. Eve tool outputs must be
  // composed only of JSON values before they are passed back into the model.
  return {
    id: String(row.id),
    booking_request_id: row.booking_request_id == null ? null : String(row.booking_request_id),
    conversation_id: row.conversation_id == null ? null : String(row.conversation_id),
    message_id: row.message_id == null ? null : String(row.message_id),
    task: String(row.task),
    model: String(row.model),
    latency_ms: Number(row.latency_ms),
    input_summary: String(row.input_summary),
    output_summary: String(row.output_summary),
    created_at:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
  };
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
