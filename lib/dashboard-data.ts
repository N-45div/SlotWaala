import { createSqlClient } from "@/lib/neon/server";
import {
  bookingRequests as demoBookingRequests,
  meshTraces as demoMeshTraces,
  type BookingRequest,
  type MeshTrace,
} from "@/lib/demo-data";

type BookingRow = {
  id: string;
  customer_name: string | null;
  phone: string;
  service: string | null;
  area: string | null;
  preferred_slot: string | null;
  status:
    | "needs_info"
    | "needs_owner_approval"
    | "confirmed"
    | "rejected"
    | "escalated";
  inbound_message: string | null;
  agent_draft: string | null;
  updated_at: string;
};

type TraceRow = {
  id: string;
  task: string;
  model: string;
  latency_ms: number;
  output_summary: string;
  created_at: string;
};

export type DashboardData = {
  bookingRequests: BookingRequest[];
  meshTraces: MeshTrace[];
  source: "neon" | "demo";
  error?: string;
};

function hasDatabaseUrl() {
  return Boolean(process.env.DATABASE_URL?.trim());
}

function mapStatus(status: BookingRow["status"]): BookingRequest["status"] {
  if (status === "needs_owner_approval") return "needs-approval";
  if (status === "needs_info") return "needs-info";
  if (status === "confirmed") return "confirmed";
  return "needs-info";
}

function bookingLabel(value: string | null, fallback: string) {
  return value?.trim() || fallback;
}

async function fetchLiveDashboardData(): Promise<DashboardData> {
  const sql = createSqlClient();
  const bookingRows = (await sql`
    select
      br.id,
      c.display_name as customer_name,
      c.phone,
      br.service,
      br.area,
      br.preferred_slot,
      br.status,
      br.agent_draft,
      br.updated_at,
      latest_message.body as inbound_message
    from booking_requests br
    join customers c on c.id = br.customer_id
    left join lateral (
      select body
      from messages m
      where m.conversation_id = br.conversation_id
        and m.direction = 'inbound'
      order by m.created_at desc
      limit 1
    ) latest_message on true
    order by br.updated_at desc
    limit 25
  `) as BookingRow[];

  const selectedBookingId = bookingRows[0]?.id ?? null;
  const traceRows = selectedBookingId
    ? ((await sql`
        select id, task, model, latency_ms, output_summary, created_at
        from mesh_traces
        where booking_request_id = ${selectedBookingId}
        order by created_at desc
        limit 8
      `) as TraceRow[])
    : ((await sql`
        select id, task, model, latency_ms, output_summary, created_at
        from mesh_traces
        order by created_at desc
        limit 8
      `) as TraceRow[]);

  return {
    source: "neon",
    bookingRequests: bookingRows.map((row) => ({
      id: row.id,
      customerName: bookingLabel(row.customer_name, "WhatsApp customer"),
      phone: row.phone,
      service: bookingLabel(row.service, "Service request"),
      area: bookingLabel(row.area, "Area pending"),
      preferredSlot: bookingLabel(row.preferred_slot, "Slot pending"),
      status: mapStatus(row.status),
      inboundMessage: bookingLabel(row.inbound_message, "No inbound message stored."),
      agentDraft: bookingLabel(row.agent_draft, "Draft pending owner review."),
    })),
    meshTraces: traceRows.map((trace) => ({
      id: trace.id,
      task: trace.task,
      model: trace.model,
      latencyMs: trace.latency_ms,
      summary: trace.output_summary,
    })),
  };
}

export async function getDashboardData(): Promise<DashboardData> {
  if (!hasDatabaseUrl()) {
    return {
      source: "demo",
      bookingRequests: demoBookingRequests,
      meshTraces: demoMeshTraces,
    };
  }

  try {
    return await fetchLiveDashboardData();
  } catch (error) {
    return {
      source: "demo",
      bookingRequests: demoBookingRequests,
      meshTraces: demoMeshTraces,
      error: error instanceof Error ? error.message : "Unable to load Neon dashboard data.",
    };
  }
}
