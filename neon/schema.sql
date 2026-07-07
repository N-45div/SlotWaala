create extension if not exists "pgcrypto";

create table if not exists businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  whatsapp_number text,
  created_at timestamptz not null default now()
);

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
  status text not null default 'needs_info' check (
    status in ('needs_info', 'needs_owner_approval', 'confirmed', 'rejected', 'escalated')
  ),
  missing_fields text[] not null default '{}',
  agent_draft text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists mesh_traces (
  id uuid primary key default gen_random_uuid(),
  booking_request_id uuid references booking_requests(id) on delete set null,
  task text not null,
  model text not null,
  latency_ms integer not null check (latency_ms >= 0),
  input_summary text not null,
  output_summary text not null,
  created_at timestamptz not null default now()
);

create index if not exists customers_business_phone_idx on customers (business_id, phone);
create index if not exists conversations_customer_idx on conversations (customer_id, updated_at desc);
create index if not exists booking_requests_business_status_idx on booking_requests (business_id, status, updated_at desc);
create index if not exists mesh_traces_booking_idx on mesh_traces (booking_request_id, created_at desc);
