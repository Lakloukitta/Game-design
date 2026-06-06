-- ============================================================================
-- Trip Autopilot — initial schema (001)
--
-- Four tables back the flight-booking vertical slice. Row Level Security is
-- enabled on every table and NO public/anonymous policies are created: the only
-- access path in this MVP is the server-side privileged client (service/secret
-- key), which bypasses RLS. We deliberately add no permissive policies yet so
-- that, if the anon/public keys are ever used, they have zero access by default.
-- Per-user policies will be added when user accounts are introduced.
-- ============================================================================

create extension if not exists pgcrypto;

-- ── Reusable updated_at trigger ─────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── A. trip_requests ────────────────────────────────────────────────────────
create table if not exists trip_requests (
  id                  uuid primary key default gen_random_uuid(),
  status              text not null,
  origin              char(3) not null,
  destination         char(3) not null,
  departure_date      date not null,
  return_date         date not null,
  adults              integer not null default 1,
  cabin_class         text not null,
  max_connections     integer not null,
  supplier_request_id text,
  error               jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint trip_requests_status_chk check (status in (
    'DRAFT','SEARCHING','PROPOSAL_READY','REVALIDATING','APPROVED','BOOKING',
    'CONFIRMED','PENDING_SUPPLIER','PRICE_CHANGED','EXPIRED','FAILED'
  )),
  -- Today's MVP supports exactly one adult traveler.
  constraint trip_requests_adults_chk check (adults = 1),
  constraint trip_requests_route_chk check (origin <> destination),
  constraint trip_requests_dates_chk check (return_date > departure_date),
  constraint trip_requests_cabin_chk check (cabin_class in (
    'economy','premium_economy','business','first'
  )),
  constraint trip_requests_connections_chk check (max_connections between 0 and 2)
);

create trigger trip_requests_set_updated_at
  before update on trip_requests
  for each row execute function set_updated_at();

-- ── B. flight_offers ────────────────────────────────────────────────────────
create table if not exists flight_offers (
  id                  uuid primary key default gen_random_uuid(),
  trip_request_id     uuid not null references trip_requests(id) on delete cascade,
  supplier            text not null default 'duffel',
  supplier_offer_id   text not null,
  airline_name        text not null,
  marketing_carriers  text[] not null default '{}',
  operating_carriers  text[] not null default '{}',
  total_amount        numeric(12,2) not null,
  currency            char(3) not null,
  duration_minutes    integer not null,
  max_stops           integer not null,
  score               numeric(6,4) not null,
  departure_at        timestamptz,
  final_arrival_at    timestamptz,
  expires_at          timestamptz not null,
  raw                 jsonb not null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint flight_offers_amount_chk check (total_amount > 0),
  constraint flight_offers_duration_chk check (duration_minutes > 0),
  constraint flight_offers_stops_chk check (max_stops >= 0),
  constraint flight_offers_unique_offer unique (trip_request_id, supplier_offer_id)
);

create trigger flight_offers_set_updated_at
  before update on flight_offers
  for each row execute function set_updated_at();

-- ── C. booking_attempts ─────────────────────────────────────────────────────
-- NOTE: This table intentionally stores NO passenger PII (no names, birth
-- dates, emails, phone numbers, passports) and no card data.
create table if not exists booking_attempts (
  id                   uuid primary key default gen_random_uuid(),
  trip_request_id      uuid not null references trip_requests(id) on delete cascade,
  supplier_offer_id    text not null,
  idempotency_key      uuid not null unique,
  status               text not null,
  quoted_amount        numeric(12,2),
  confirmed_amount     numeric(12,2),
  currency             char(3),
  supplier_order_id    text,
  booking_reference    text,
  supplier_http_status integer,
  supplier_response    jsonb,
  error                jsonb,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint booking_attempts_status_chk check (status in (
    'CREATED','REVALIDATING','BOOKING','CONFIRMED','PENDING_SUPPLIER',
    'PRICE_CHANGED','EXPIRED','FAILED'
  ))
);

create trigger booking_attempts_set_updated_at
  before update on booking_attempts
  for each row execute function set_updated_at();

-- ── D. audit_events ─────────────────────────────────────────────────────────
-- NOTE: event_data must never contain passenger PII.
create table if not exists audit_events (
  id                bigint generated always as identity primary key,
  trip_request_id   uuid references trip_requests(id) on delete cascade,
  booking_attempt_id uuid references booking_attempts(id) on delete cascade,
  event_type        text not null,
  event_data        jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now()
);

-- ── Indexes ─────────────────────────────────────────────────────────────────
create index if not exists idx_flight_offers_trip on flight_offers(trip_request_id);
create index if not exists idx_flight_offers_expires on flight_offers(expires_at);
create index if not exists idx_booking_attempts_trip on booking_attempts(trip_request_id);
create index if not exists idx_booking_attempts_idem on booking_attempts(idempotency_key);
create index if not exists idx_audit_events_trip on audit_events(trip_request_id);
create index if not exists idx_audit_events_booking on audit_events(booking_attempt_id);
create index if not exists idx_trip_requests_created on trip_requests(created_at);

-- ── Row Level Security (enabled, no public policies) ─────────────────────────
-- The server-side privileged client is the ONLY intended access path for this
-- MVP. With RLS enabled and no policies, anon/public roles get no access, while
-- the service/secret key bypasses RLS. Do NOT add anonymous write policies here.
alter table trip_requests   enable row level security;
alter table flight_offers   enable row level security;
alter table booking_attempts enable row level security;
alter table audit_events    enable row level security;
