import { createSqlClient } from "@/lib/neon/server";
import { listAvailabilityWindows, type AvailabilityWindow } from "@/lib/availability";
import { resolveBusinessId } from "@/lib/businesses";
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
    | "approved"
    | "confirmed"
    | "rejected"
    | "escalated"
    | "canceled";
  inbound_message: string | null;
  agent_draft: string | null;
  updated_at: string;
};

type BusinessRow = {
  id: string;
  name: string;
};

type EscalationRow = {
  id: string;
  status: "open" | "resolved";
  categories: string[];
  reason: string;
  redacted_message: string;
  recommended_owner_action: string | null;
  created_at: string;
  customer_name: string | null;
  customer_phone: string | null;
};

type RecoveryOfferRow = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: "pending_owner" | "sent" | "accepted" | "expired" | "canceled";
  message: string | null;
  service: string | null;
  customer_name: string | null;
  customer_phone: string;
};

type TraceRow = {
  id: string;
  booking_request_id: string | null;
  task: string;
  model: string;
  latency_ms: number;
  output_summary: string;
  created_at: string;
};

export type DashboardMetrics = {
  dueReminders: number;
  openEscalations: number;
  confirmedToday: number;
};

export type DashboardBusiness = {
  id: string;
  name: string;
};

export type DashboardEscalation = {
  id: string;
  status: "open" | "resolved";
  categories: string[];
  reason: string;
  redactedMessage: string;
  recommendedOwnerAction: string | null;
  customerLabel: string;
  createdAt: string;
};

export type DashboardRecoveryOffer = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: "pending_owner" | "sent" | "accepted" | "expired" | "canceled";
  message: string;
  service: string;
  customerLabel: string;
};

export type DashboardData = {
  bookingRequests: BookingRequest[];
  meshTraces: MeshTrace[];
  metrics: DashboardMetrics;
  business?: DashboardBusiness;
  availabilityWindows: AvailabilityWindow[];
  escalations: DashboardEscalation[];
  recoveryOffers: DashboardRecoveryOffer[];
  updatedAt: string;
  source: "neon" | "demo";
  error?: string;
};

function hasDatabaseUrl() {
  return Boolean(process.env.DATABASE_URL?.trim());
}

function mapStatus(status: BookingRow["status"]): BookingRequest["status"] {
  if (status === "needs_owner_approval") return "needs-approval";
  if (status === "needs_info") return "needs-info";
  if (status === "approved") return "approved";
  if (status === "confirmed") return "confirmed";
  if (status === "rejected") return "rejected";
  if (status === "escalated") return "escalated";
  if (status === "canceled") return "canceled";
  return "needs-info";
}

function bookingLabel(value: string | null, fallback: string) {
  return value?.trim() || fallback;
}

function traceSummary(value: string) {
  return value
    .replace(/```(?:json)?/gi, "")
    .replace(/```/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220);
}

async function fetchLiveDashboardData(): Promise<DashboardData> {
  const sql = createSqlClient();
  const businessId = await resolveBusinessId();
  const businessRows = (await sql`
    select id, name
    from businesses
    where id = ${businessId}
    limit 1
  `) as BusinessRow[];
  const business = businessRows[0];
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
    where br.business_id = ${businessId}
    order by br.updated_at desc
    limit 25
  `) as BookingRow[];

  const traceRows = (await sql`
    select id, booking_request_id, task, model, latency_ms, output_summary, created_at
    from mesh_traces
    where (
      conversation_id in (select id from conversations where business_id = ${businessId})
      or booking_request_id in (select id from booking_requests where business_id = ${businessId})
    )
    order by created_at desc
    limit 24
  `) as TraceRow[];
  const reminderRows = (await sql`
    select count(*)::int as due_reminders
    from reminders r
    join booking_requests br on br.id = r.booking_request_id
    where br.business_id = ${businessId}
      and r.status = 'scheduled'
      and remind_at <= now() + interval '2 hours'
  `) as Array<{ due_reminders: number }>;
  const confirmedRows = (await sql`
    select count(*)::int as confirmed_today
    from booking_requests
    where business_id = ${businessId}
      and status = 'confirmed'
      and updated_at >= current_date
  `) as Array<{ confirmed_today: number }>;
  const escalationRows = (await sql`
    select
      e.id,
      e.status,
      e.categories,
      e.reason,
      e.redacted_message,
      e.recommended_owner_action,
      e.created_at,
      c.display_name as customer_name,
      c.phone as customer_phone
    from escalations e
    left join customers c on c.id = e.customer_id
    where e.business_id = ${businessId}
      and e.status = 'open'
    order by e.created_at desc
    limit 12
  `) as EscalationRow[];
  const availabilityWindows = business ? await listAvailabilityWindows(business.id) : [];
  const recoveryOfferRows = (await sql`
    select
      offer.id,
      offer.starts_at,
      offer.ends_at,
      offer.status,
      offer.message,
      waitlist.service,
      customer.display_name as customer_name,
      customer.phone as customer_phone
    from recovery_offers offer
    join waitlist_entries waitlist on waitlist.id = offer.waitlist_entry_id
    join customers customer on customer.id = waitlist.customer_id
    where waitlist.business_id = ${businessId}
      and offer.status in ('pending_owner', 'sent')
    order by offer.created_at desc
    limit 12
  `) as RecoveryOfferRow[];

  return {
    source: "neon",
    metrics: {
      dueReminders: reminderRows[0]?.due_reminders ?? 0,
      openEscalations: escalationRows.length,
      confirmedToday: confirmedRows[0]?.confirmed_today ?? 0,
    },
    business: business ? { id: business.id, name: business.name } : undefined,
    availabilityWindows,
    escalations: escalationRows.map((row) => ({
      id: row.id,
      status: row.status,
      categories: row.categories,
      reason: row.reason,
      redactedMessage: row.redacted_message,
      recommendedOwnerAction: row.recommended_owner_action,
      customerLabel: row.customer_name || row.customer_phone || "WhatsApp customer",
      createdAt: row.created_at,
    })),
    recoveryOffers: recoveryOfferRows.map((row) => ({
      id: row.id,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      status: row.status,
      message: row.message || "A released service slot is ready for owner review.",
      service: row.service || "Service slot",
      customerLabel: row.customer_name || row.customer_phone,
    })),
    updatedAt: new Date().toISOString(),
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
      bookingRequestId: trace.booking_request_id ?? undefined,
      task: trace.task,
      model: trace.model,
      latencyMs: trace.latency_ms,
      summary: traceSummary(trace.output_summary),
    })),
  };
}

export async function getDashboardData(): Promise<DashboardData> {
  if (!hasDatabaseUrl()) {
    return {
      source: "demo",
      bookingRequests: demoBookingRequests,
      meshTraces: demoMeshTraces,
      metrics: { dueReminders: 4, openEscalations: 0, confirmedToday: 1 },
      availabilityWindows: [],
      escalations: [],
      recoveryOffers: [],
      updatedAt: new Date().toISOString(),
    };
  }

  try {
    return await fetchLiveDashboardData();
  } catch (error) {
    return {
      source: "demo",
      bookingRequests: demoBookingRequests,
      meshTraces: demoMeshTraces,
      metrics: { dueReminders: 4, openEscalations: 0, confirmedToday: 1 },
      availabilityWindows: [],
      escalations: [],
      recoveryOffers: [],
      updatedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unable to load Neon dashboard data.",
    };
  }
}
