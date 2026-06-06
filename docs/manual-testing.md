# Manual testing

These scenarios can be run in **mock mode** (no credentials) or against the real
Duffel sandbox. In mock mode, specific offer IDs trigger each scenario.

Start the app:

```bash
TRAVEL_APP_MOCK_MODE=true NEXT_PUBLIC_TRAVEL_APP_MOCK_MODE=true npm run dev
```

## Mock offer reference

| Offer ID | Scenario |
|---|---|
| `off_mock_best` | Normal bookable; confirms |
| `off_mock_cheap` | Lowest price, 2 stops; confirms |
| `off_mock_fast` | Nonstop, shortest, highest price; confirms |
| `off_mock_balanced` | Mid-tier alternative |
| `off_mock_pricechange` | Re-fetch returns a higher price → PRICE_CHANGED |
| `off_mock_expired` | Already expired → EXPIRED |
| `off_mock_docs` | Requires identity documents → 422 |
| `off_mock_pending` | Order creation returns PENDING_SUPPLIER |
| `off_mock_fail` | Order creation FAILS |

## Happy path

- Origin `LHR`, Destination `JFK`, Departure a future date, Return 7 days later,
  Cabin `economy`, Max connections `1`.

Expected:

1. A trip row is created; status becomes `PROPOSAL_READY`.
2. Offers are persisted; up to three **unique** proposals appear.
3. The **operating carrier** is shown on each card; expiry is shown.
4. Selecting a proposal triggers revalidation (“Confirming that this fare is
   still available…”).
5. Synthetic passenger details can be entered.
6. Submitting creates **one** test order attempt.
7. Clicking submit again returns the **same** booking attempt (no duplicate).
8. The final status is truthful (`CONFIRMED` for `off_mock_best/cheap/fast`).

## Validation

Confirm each is rejected with a clear message and no network booking call:

- Origin equals destination.
- Invalid IATA (e.g. `LH`, `LHRR`, `12A`).
- Return date before departure.
- Departure date in the past.
- Invalid international phone (e.g. `4155550123` without `+`).
- Underage passenger (date of birth makes them < 18 on departure).
- Invalid email.

## Supplier scenarios (select the matching mock offer)

- **No offers** — (real sandbox) search a route with no inventory → controlled
  “No valid flight offers” message; trip `FAILED`.
- **Expired offer** — select `off_mock_expired` → revalidation reports expired;
  checkout disabled; “Search again”.
- **Price changed** — select `off_mock_pricechange` → revalidation shows the new
  price; you must click **Approve new price** before continuing; the original
  attempt is never booked.
- **Documents required** — select `off_mock_docs`, approve, submit → `422` with a
  message suggesting another offer; no passport is collected.
- **Order failure** — `off_mock_fail` → `FAILED` state with a human-readable
  message and a note that no duplicate booking was created.
- **Pending order** — `off_mock_pending` → `PENDING_SUPPLIER` (amber); use
  **Refresh status** to reconcile (mock promotes it to confirmed).
- **Timeout** — (real sandbox) exercised via Duffel’s error routes / network
  conditions → `504` controlled error.

## Idempotency

1. Approve a fare and submit the booking once.
2. Repeat the exact request with the **same** `checkoutAttemptId`.
3. Verify exactly **one** `booking_attempts` row exists.
4. Verify exactly **one** supplier order call occurred.
5. Verify the repeated response reports the existing state.

CLI reproduction (mock mode, single server session):

```bash
TID=$(curl -s -X POST localhost:3000/api/trips/search -H 'Content-Type: application/json' \
  -d '{"origin":"LHR","destination":"JFK","departureDate":"2032-05-01","returnDate":"2032-05-08","cabinClass":"economy","maxConnections":1}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["tripRequestId"])')

curl -s -X POST localhost:3000/api/offers/revalidate -H 'Content-Type: application/json' \
  -d "{\"tripRequestId\":\"$TID\",\"offerId\":\"off_mock_cheap\",\"previouslyDisplayedAmount\":\"389.99\",\"previouslyDisplayedCurrency\":\"GBP\"}"

KEY=$(python3 -c 'import uuid;print(uuid.uuid4())')
REQ="{\"tripRequestId\":\"$TID\",\"offerId\":\"off_mock_cheap\",\"checkoutAttemptId\":\"$KEY\",\"acceptedAmount\":\"389.99\",\"acceptedCurrency\":\"GBP\",\"passenger\":{\"title\":\"mr\",\"gender\":\"m\",\"givenName\":\"Test\",\"familyName\":\"Traveller\",\"bornOn\":\"1990-01-01\",\"email\":\"test@example.com\",\"phoneNumber\":\"+14155550123\"}}"
curl -s -X POST localhost:3000/api/bookings/test -H 'Content-Type: application/json' -d "$REQ"  # CONFIRMED
curl -s -X POST localhost:3000/api/bookings/test -H 'Content-Type: application/json' -d "$REQ"  # same bookingAttemptId
```

## Browser-refresh recovery

After reaching proposals or a booking, refresh the page. The app restores the
trip/proposals (and booking, if any) from the server via the status endpoints and
**never** auto-resubmits a booking.

> When testing against the real Duffel sandbox, use Duffel's current published
> test inventory and error-scenario routes; verify them in the Duffel docs first.
