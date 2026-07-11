import { createSqlClient } from "@/lib/neon/server";

export type AvailabilityWindow = {
  id: string;
  businessId: string;
  service: string | null;
  weekday: number;
  startTime: string;
  endTime: string;
  slotMinutes: number;
  timezone: string;
};

export type AvailableSlot = {
  startsAt: string;
  endsAt: string;
  service: string | null;
  timezone: string;
};

type AvailableSlotRow = {
  starts_at: string;
  ends_at: string;
  service: string | null;
  timezone: string;
};

type AvailabilityWindowRow = {
  id: string;
  business_id: string;
  service: string | null;
  weekday: number;
  start_time: string;
  end_time: string;
  slot_minutes: number;
  timezone: string;
};

export async function listAvailabilityWindows(businessId: string): Promise<AvailabilityWindow[]> {
  const sql = createSqlClient();
  const rows = (await sql`
    select id, business_id, service, weekday, start_time::text, end_time::text, slot_minutes, timezone
    from availability_windows
    where business_id = ${businessId}
      and active = true
    order by weekday asc, start_time asc
  `) as AvailabilityWindowRow[];

  return rows.map((row) => ({
    id: row.id,
    businessId: row.business_id,
    service: row.service,
    weekday: row.weekday,
    startTime: row.start_time,
    endTime: row.end_time,
    slotMinutes: row.slot_minutes,
    timezone: row.timezone,
  }));
}

export async function findAvailableSlots(input: {
  businessId: string;
  service?: string;
  preferredWindow?: string;
  limit?: number;
}): Promise<AvailableSlot[]> {
  const sql = createSqlClient();
  const requestedService = input.service?.trim() || null;
  const preferredRange = parsePreferredWindow(input.preferredWindow);
  const rows = (await sql`
    with candidate_slots as (
      select
        slot_start as starts_at,
        slot_start + make_interval(mins => availability.slot_minutes) as ends_at,
        availability.service,
        availability.timezone
      from availability_windows availability
      cross join lateral generate_series(
        current_date,
        current_date + 14,
        interval '1 day'
      ) as calendar_day(day)
      cross join lateral generate_series(
        ((calendar_day.day::date + availability.start_time) at time zone availability.timezone),
        ((calendar_day.day::date + availability.end_time) at time zone availability.timezone)
          - make_interval(mins => availability.slot_minutes),
        make_interval(mins => availability.slot_minutes)
      ) as slot_start
      where availability.business_id = ${input.businessId}
        and availability.active = true
        and extract(dow from calendar_day.day)::int = availability.weekday
        and (${requestedService}::text is null
          or availability.service is null
          or lower(availability.service) = lower(${requestedService}))
    )
    select starts_at, ends_at, service, timezone
    from candidate_slots candidate
    where candidate.starts_at > now()
      and (${preferredRange?.startHour ?? null}::int is null
        or extract(hour from (candidate.starts_at at time zone candidate.timezone)) >= ${preferredRange?.startHour ?? null}
        and extract(hour from (candidate.starts_at at time zone candidate.timezone)) < ${preferredRange?.endHour ?? null})
      and not exists (
        select 1
        from slot_holds held
        where held.business_id = ${input.businessId}
          and held.status in ('held', 'confirmed')
          and (held.status = 'confirmed' or held.expires_at > now())
          and held.starts_at < candidate.ends_at
          and held.ends_at > candidate.starts_at
      )
    order by starts_at asc
    limit ${Math.min(Math.max(input.limit ?? 4, 1), 12)}
  `) as AvailableSlotRow[];

  return rows.map((row) => ({
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    service: row.service,
    timezone: row.timezone,
  }));
}

function parsePreferredWindow(value?: string) {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (!normalized) return null;
  if (normalized.includes("morning")) return { startHour: 6, endHour: 12 };
  if (normalized.includes("afternoon")) return { startHour: 12, endHour: 17 };
  if (normalized.includes("evening")) return { startHour: 17, endHour: 22 };
  if (normalized.includes("night") || normalized.includes("tonight")) return { startHour: 19, endHour: 23 };
  return null;
}

export async function holdSlotForBooking(input: {
  businessId: string;
  bookingRequestId: string;
  startsAt: string;
  endsAt: string;
}) {
  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);

  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
    throw new Error("A valid proposed slot start and end are required.");
  }

  const sql = createSqlClient();
  const configuredWindow = await sql`
    select availability.id
    from availability_windows availability
    join booking_requests booking on booking.id = ${input.bookingRequestId}
    where availability.business_id = ${input.businessId}
      and booking.business_id = ${input.businessId}
      and availability.active = true
      and (
        availability.service is null
        or booking.service is null
        or lower(availability.service) = lower(booking.service)
      )
      and extract(dow from (${startsAt.toISOString()}::timestamptz at time zone availability.timezone))::int = availability.weekday
      and (${startsAt.toISOString()}::timestamptz at time zone availability.timezone)::time >= availability.start_time
      and (${endsAt.toISOString()}::timestamptz at time zone availability.timezone)::time <= availability.end_time
    limit 1
  `;

  if (configuredWindow.length === 0) {
    throw new Error("The proposed slot is outside the owner's configured availability.");
  }

  const overlapping = await sql`
    select id
    from slot_holds
    where business_id = ${input.businessId}
      and status in ('held', 'confirmed')
      and (status = 'confirmed' or expires_at > now())
      and starts_at < ${endsAt.toISOString()}
      and ends_at > ${startsAt.toISOString()}
    limit 1
  `;

  if (overlapping.length > 0) {
    throw new Error("That slot is no longer available.");
  }

  const rows = await sql`
    insert into slot_holds (
      business_id,
      booking_request_id,
      starts_at,
      ends_at,
      status,
      expires_at
    )
    values (
      ${input.businessId},
      ${input.bookingRequestId},
      ${startsAt.toISOString()},
      ${endsAt.toISOString()},
      'held',
      now() + interval '20 minutes'
    )
    returning id, starts_at, ends_at, status, expires_at
  `;

  return rows[0];
}

export async function confirmSlotHold(bookingRequestId: string) {
  const sql = createSqlClient();
  const existing = await sql`
    select id
    from slot_holds
    where booking_request_id = ${bookingRequestId}
    limit 1
  `;

  if (existing.length === 0) return true;

  const confirmed = await sql`
    update slot_holds
    set status = 'confirmed', expires_at = null, confirmed_at = now()
    where booking_request_id = ${bookingRequestId}
      and status = 'held'
      and expires_at > now()
    returning id
  `;
  return confirmed.length > 0;
}

export async function releaseSlotHold(bookingRequestId: string) {
  const sql = createSqlClient();
  await sql`
    update slot_holds
    set status = 'released', released_at = now()
    where booking_request_id = ${bookingRequestId}
      and status in ('held', 'confirmed')
  `;
}
