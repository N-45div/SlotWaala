create extension if not exists "pgcrypto";

create table if not exists businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  whatsapp_number text,
  created_at timestamptz not null default now()
);

create unique index if not exists businesses_whatsapp_number_idx
  on businesses (whatsapp_number)
  where whatsapp_number is not null;

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  display_name text,
  phone text not null,
  created_at timestamptz not null default now(),
  unique (business_id, phone)
);

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  channel text not null default 'whatsapp' check (channel in ('whatsapp', 'sms', 'email')),
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  direction text not null check (direction in ('inbound', 'outbound')),
  body text not null,
  external_id text,
  created_at timestamptz not null default now()
);

create table if not exists booking_requests (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  service text,
  area text,
  preferred_slot text,
  status text not null default 'needs_info',
  missing_fields text[] not null default '{}',
  agent_draft text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table booking_requests
  drop constraint if exists booking_requests_status_check;

alter table booking_requests
  add constraint booking_requests_status_check check (
    status in ('needs_info', 'needs_owner_approval', 'approved', 'confirmed', 'rejected', 'escalated', 'canceled')
  );

create table if not exists availability_windows (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  service text,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  slot_minutes integer not null default 30 check (slot_minutes between 15 and 240),
  timezone text not null default 'Asia/Kolkata',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);

create table if not exists slot_holds (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  booking_request_id uuid not null unique references booking_requests(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'held' check (status in ('held', 'confirmed', 'released', 'expired')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  released_at timestamptz,
  check (ends_at > starts_at)
);

create table if not exists escalations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  customer_id uuid references customers(id) on delete set null,
  conversation_id uuid references conversations(id) on delete set null,
  message_id uuid references messages(id) on delete set null,
  status text not null default 'open' check (status in ('open', 'resolved')),
  categories text[] not null default '{}',
  reason text not null,
  redacted_message text not null,
  recommended_owner_action text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  service text,
  preferred_window text,
  status text not null default 'waiting' check (status in ('waiting', 'offered', 'accepted', 'expired', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists recovery_offers (
  id uuid primary key default gen_random_uuid(),
  released_booking_request_id uuid not null references booking_requests(id) on delete cascade,
  waitlist_entry_id uuid not null references waitlist_entries(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'pending_owner' check (status in ('pending_owner', 'sent', 'accepted', 'expired', 'canceled')),
  message text,
  external_id text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  accepted_at timestamptz,
  unique (released_booking_request_id, waitlist_entry_id)
);

create table if not exists mesh_traces (
  id uuid primary key default gen_random_uuid(),
  booking_request_id uuid references booking_requests(id) on delete set null,
  conversation_id uuid references conversations(id) on delete set null,
  message_id uuid references messages(id) on delete set null,
  task text not null,
  model text not null,
  latency_ms integer not null check (latency_ms >= 0),
  input_summary text not null,
  output_summary text not null,
  created_at timestamptz not null default now()
);

create table if not exists owner_actions (
  id uuid primary key default gen_random_uuid(),
  booking_request_id uuid not null references booking_requests(id) on delete cascade,
  action text not null check (action in ('approve', 'reject', 'request_info', 'escalate')),
  note text,
  draft_text text,
  actor text not null default 'owner',
  created_at timestamptz not null default now()
);

create table if not exists reminders (
  id uuid primary key default gen_random_uuid(),
  booking_request_id uuid not null references booking_requests(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  remind_at timestamptz not null,
  message text not null,
  status text not null default 'scheduled' check (
    status in ('scheduled', 'sending', 'sent', 'failed', 'canceled')
  ),
  external_id text,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists customers_business_phone_idx on customers (business_id, phone);
create index if not exists conversations_customer_idx on conversations (customer_id, updated_at desc);
create unique index if not exists messages_external_id_idx on messages (external_id) where external_id is not null;
create index if not exists booking_requests_business_status_idx on booking_requests (business_id, status, updated_at desc);
create index if not exists availability_windows_business_idx on availability_windows (business_id, weekday) where active;
create index if not exists slot_holds_business_range_idx on slot_holds (business_id, starts_at, ends_at);
create index if not exists escalations_business_status_idx on escalations (business_id, status, created_at desc);
create index if not exists waitlist_entries_business_status_idx on waitlist_entries (business_id, status, created_at);
create index if not exists recovery_offers_status_idx on recovery_offers (status, created_at);
create index if not exists mesh_traces_booking_idx on mesh_traces (booking_request_id, created_at desc);
create index if not exists mesh_traces_conversation_idx on mesh_traces (conversation_id, created_at desc);
create index if not exists owner_actions_booking_idx on owner_actions (booking_request_id, created_at desc);
create index if not exists reminders_due_idx on reminders (status, remind_at);
create unique index if not exists reminders_external_id_idx on reminders (external_id) where external_id is not null;
