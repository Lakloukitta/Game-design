# Architecture

Trip Autopilot is a Next.js (App Router) application with a strict separation
between UI, validation, supplier integration, normalization, ranking,
persistence, and booking orchestration.

## Component architecture

```
src/
  app/                      Next.js App Router (pages + API route handlers)
    api/                    Route handlers (server, Node runtime)
  components/               Client UI (forms, cards, panels, ui/ primitives)
    use-trip-flow.ts        Client reducer = the UI state machine
  lib/
    api/                    Structured errors, responses, presenters
    booking/                State machine + idempotency helpers
    client/                 Browser API client (no server imports)
    config/                 Validated environment configuration
    database/               TripRepository interface + Supabase & in-memory impls
    duffel/                 Supplier types, schemas, HTTP client, mappers
    flights/                Pure domain: duration, normalize, rank, proposals
    flows/                  Orchestration: search, revalidate, booking, status
    formatting/             Display formatting (currency, duration, date-time)
    logging/                Logger + redaction
    mock/                   Deterministic fixtures + mock supplier
    server/                 Server-only guard
    validation/             Zod schemas (trip, passenger, booking)
  types/                    Domain + narrow API response types
```

## Server / client boundary

- **Client** code (`'use client'`) imports only browser-safe modules: the API
  client, formatting helpers, validation schemas (pure Zod), and types. It never
  imports the supplier client, database, env, services, or flows.
- **Server** privileged modules import `@/lib/server/assert-server`, a build-safe
  guard that throws if executed in a browser. (We avoid the `server-only`
  package import because it can break Next's API-route page-data collection.)
- Secrets are read only in `lib/config/env.ts` on the server. Only
  `NEXT_PUBLIC_SUPABASE_URL` (and a cosmetic mock hint) reach the browser.

## Supplier abstraction

`FlightSupplier` (`lib/duffel/types.ts`) defines `search`, `getOffer`,
`createOrder`, and optional `getOrder`. Two implementations:

- `DuffelClient` — real Duffel API v2 over `fetch`, with the `Duffel-Version`
  header, bounded `AbortController` timeout, `cache: 'no-store'`, safe error
  parsing into `DuffelApiError`, and the supplier-supported `Idempotency-Key`
  header on order creation.
- `MockDuffelClient` — deterministic fixtures (≥6 offers, distinct prices /
  durations / stops, plus price-change, expired, documents-required, pending,
  and failure scenarios).

`getServices()` injects the right pair. Flows depend only on the interfaces, so
routes are identical in real and mock mode, and tests inject fakes.

## Database model

`TripRepository` (`lib/database/types.ts`) abstracts persistence. Implementations:

- `SupabaseRepository` — privileged server client; validates state transitions
  before writes; resolves the unique-key idempotency race (Postgres `23505`).
- `InMemoryRepository` — used by tests and by mock mode without a database;
  models the unique idempotency constraint with a synchronous check-and-set.

Four tables: `trip_requests`, `flight_offers`, `booking_attempts`,
`audit_events`. RLS is enabled with no public policies. `booking_attempts` and
`audit_events` store **no** passenger PII.

## Why ranking is deterministic (no LLM)

Pricing, availability, durations, carriers, fees, and booking status must be
authoritative supplier facts. Ranking is a pure, weighted, reproducible function
(`0.5·price + 0.3·duration + 0.2·stops`, with inverse-normalized price/duration
and a fixed stop score). Proposal explanations are templated from structured
values. No model invents numbers, and ranking is unit-tested for stability.

## Why AI does not control booking

Booking is a safety- and money-adjacent state machine. Transitions are validated
by deterministic code (`lib/booking/state-machine.ts`); the supplier response is
interpreted truthfully (`CONFIRMED` only when the supplier establishes it);
idempotency prevents duplicate orders. No agent decides prices, approvals, or
confirmations.

## Failure boundaries

- Validation errors → `400` with structured `fieldErrors`.
- Not found → `404`. State conflicts / price change / expiry → `409`.
- Unsupported document requirement → `422`.
- Supplier failure → `502`; timeout → `504`; missing dependency / config →
  `503`. Unknown → `500` (opaque message; full detail logged server-side only).

All routes funnel through `handleRouteError`, which redacts internals and adds a
correlation `requestId`.

## Extension points for hotels & activities

- `FlightSupplier` generalizes to a `Supplier` per product; add
  `HotelSupplier` / `ActivitySupplier` with their own normalize/rank modules.
- `trip_requests` already models a trip envelope; add product-specific offer and
  attempt tables mirroring `flight_offers` / `booking_attempts`.
- The flow layer (`lib/flows`) is the natural place to add per-product
  orchestration without touching UI or persistence interfaces.
- The UI state machine (`use-trip-flow.ts`) can be extended with additional
  product phases while preserving the search → compare → approve → confirm spine.
