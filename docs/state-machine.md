# State machines

All transitions are validated by deterministic code in
`src/lib/booking/state-machine.ts`. Illegal transitions throw and are surfaced as
controlled errors.

## Trip state

```mermaid
stateDiagram-v2
  [*] --> DRAFT
  DRAFT --> SEARCHING
  SEARCHING --> PROPOSAL_READY
  SEARCHING --> FAILED
  PROPOSAL_READY --> REVALIDATING
  REVALIDATING --> APPROVED
  REVALIDATING --> PRICE_CHANGED
  REVALIDATING --> EXPIRED
  REVALIDATING --> FAILED
  APPROVED --> BOOKING
  BOOKING --> CONFIRMED
  BOOKING --> PENDING_SUPPLIER
  BOOKING --> PRICE_CHANGED
  BOOKING --> EXPIRED
  BOOKING --> FAILED
  PRICE_CHANGED --> REVALIDATING: after new user approval
  PENDING_SUPPLIER --> CONFIRMED
  PENDING_SUPPLIER --> FAILED
  CONFIRMED --> [*]
  EXPIRED --> [*]
  FAILED --> [*]
```

## Booking-attempt state

```mermaid
stateDiagram-v2
  [*] --> CREATED
  CREATED --> REVALIDATING
  REVALIDATING --> BOOKING
  REVALIDATING --> PRICE_CHANGED
  REVALIDATING --> EXPIRED
  REVALIDATING --> FAILED
  BOOKING --> CONFIRMED
  BOOKING --> PENDING_SUPPLIER
  BOOKING --> FAILED
  PENDING_SUPPLIER --> CONFIRMED
  PENDING_SUPPLIER --> FAILED
  CONFIRMED --> [*]
  PRICE_CHANGED --> [*]
  EXPIRED --> [*]
  FAILED --> [*]
```

## Price-change approval loop

A booking is never created when the supplier amount/currency differs from what
the user approved. The original attempt is left immutable as an audit record; a
genuinely new commercial decision uses a **new** `checkoutAttemptId`.

```mermaid
sequenceDiagram
  participant UI as Browser
  participant API as /api
  participant S as Duffel (test)

  UI->>API: POST /api/bookings/test (key K1, accepted A1)
  API->>S: Re-validate selected offer
  S-->>API: current amount A2 (A2 ≠ A1)
  API-->>UI: 409 PRICE_CHANGED {previous A1, current A2}
  note right of API: attempt(K1)=PRICE_CHANGED (immutable),<br/>trip=PRICE_CHANGED
  UI->>UI: Show "fare changed. No reservation was made."
  UI->>API: POST /api/offers/revalidate (accept A2)  %% renewed approval
  API-->>UI: APPROVED at A2
  UI->>API: POST /api/bookings/test (NEW key K2, accepted A2)
  API->>S: Re-validate, create order
  S-->>API: confirmed
  API-->>UI: CONFIRMED
```

## Idempotent retry behaviour

The browser generates one `checkoutAttemptId` per approved decision and reuses
it across network retries of unknown outcome. The server keys the attempt on this
UUID (unique DB constraint). A duplicate request never calls the supplier again.

```mermaid
sequenceDiagram
  participant UI as Browser
  participant API as /api
  participant DB as Repository
  participant S as Duffel (test)

  UI->>API: POST /api/bookings/test (key K)
  API->>DB: createBookingAttempt(K)
  DB-->>API: created=true
  API->>S: create order
  S-->>API: CONFIRMED
  API->>DB: attempt(K)=CONFIRMED
  API-->>UI: CONFIRMED

  UI->>API: POST /api/bookings/test (key K)  %% retry / double click
  API->>DB: createBookingAttempt(K)
  DB-->>API: created=false (existing)
  note right of API: supplier NOT called again
  API-->>UI: echo existing CONFIRMED
```

Concurrent duplicates resolve to a single supplier call: one insert wins, the
other catches the unique violation and returns the existing attempt.
