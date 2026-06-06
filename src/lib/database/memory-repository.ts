/**
 * In-memory TripRepository for tests. Mirrors the constraints that matter for
 * behavior: state-transition validation and the unique idempotency key. The
 * unique-key race is simulated by `createBookingAttempt` rejecting a duplicate
 * key after the first insert.
 */
import type {
  AuditEventInput,
  AuditEventRow,
  BookingAttemptRow,
  CreateBookingAttemptResult,
  FlightOfferRow,
  NewBookingAttempt,
  NewFlightOffer,
  NewTripRequest,
  TripRepository,
  TripRequestRow,
} from './types';
import type { BookingStatus, TripStatus } from '@/types/domain';
import { ApiError } from '@/lib/api/errors';
import { assertBookingTransition, assertTripTransition } from '@/lib/booking/state-machine';

function nowIso(): string {
  return new Date().toISOString();
}

export class InMemoryRepository implements TripRepository {
  trips = new Map<string, TripRequestRow>();
  offers: FlightOfferRow[] = [];
  bookings = new Map<string, BookingAttemptRow>();
  auditEvents: AuditEventRow[] = [];
  private auditSeq = 0;

  async createTripRequest(input: NewTripRequest): Promise<TripRequestRow> {
    const id = crypto.randomUUID();
    const ts = nowIso();
    const row: TripRequestRow = {
      id,
      status: input.status,
      origin: input.origin,
      destination: input.destination,
      departure_date: input.departureDate,
      return_date: input.returnDate,
      adults: 1,
      cabin_class: input.cabinClass,
      max_connections: input.maxConnections,
      supplier_request_id: null,
      error: null,
      created_at: ts,
      updated_at: ts,
    };
    this.trips.set(id, row);
    return row;
  }

  async getTripRequest(id: string): Promise<TripRequestRow | null> {
    return this.trips.get(id) ?? null;
  }

  async updateTripStatus(
    id: string,
    to: TripStatus,
    patch?: Partial<Pick<TripRequestRow, 'supplier_request_id' | 'error'>>,
  ): Promise<TripRequestRow> {
    const current = this.trips.get(id);
    if (!current) throw new ApiError('NOT_FOUND', 'Trip request not found.', { retryable: false });
    assertTripTransition(current.status, to);
    const updated: TripRequestRow = { ...current, ...patch, status: to, updated_at: nowIso() };
    this.trips.set(id, updated);
    return updated;
  }

  async insertOffers(tripRequestId: string, offers: NewFlightOffer[]): Promise<void> {
    for (const o of offers) {
      const existingIdx = this.offers.findIndex(
        (r) => r.trip_request_id === tripRequestId && r.supplier_offer_id === o.supplierOfferId,
      );
      const ts = nowIso();
      const row: FlightOfferRow = {
        id: crypto.randomUUID(),
        trip_request_id: tripRequestId,
        supplier: 'duffel',
        supplier_offer_id: o.supplierOfferId,
        airline_name: o.airlineName,
        marketing_carriers: o.marketingCarriers,
        operating_carriers: o.operatingCarriers,
        total_amount: o.totalAmount,
        currency: o.currency,
        duration_minutes: o.durationMinutes,
        max_stops: o.maxStops,
        score: String(o.score),
        departure_at: o.departureAt,
        final_arrival_at: o.finalArrivalAt,
        expires_at: o.expiresAt,
        raw: o.raw,
        created_at: ts,
        updated_at: ts,
      };
      if (existingIdx >= 0) this.offers[existingIdx] = row;
      else this.offers.push(row);
    }
  }

  async getOffers(tripRequestId: string): Promise<FlightOfferRow[]> {
    return this.offers
      .filter((o) => o.trip_request_id === tripRequestId)
      .sort((a, b) => Number(b.score) - Number(a.score));
  }

  async getOffer(tripRequestId: string, supplierOfferId: string): Promise<FlightOfferRow | null> {
    return (
      this.offers.find(
        (o) => o.trip_request_id === tripRequestId && o.supplier_offer_id === supplierOfferId,
      ) ?? null
    );
  }

  async updateOffer(
    tripRequestId: string,
    supplierOfferId: string,
    patch: Partial<Pick<FlightOfferRow, 'total_amount' | 'currency' | 'expires_at' | 'raw'>>,
  ): Promise<FlightOfferRow> {
    const idx = this.offers.findIndex(
      (o) => o.trip_request_id === tripRequestId && o.supplier_offer_id === supplierOfferId,
    );
    if (idx < 0) throw new ApiError('NOT_FOUND', 'Offer not found.', { retryable: false });
    const updated: FlightOfferRow = { ...this.offers[idx]!, ...patch, updated_at: nowIso() };
    this.offers[idx] = updated;
    return updated;
  }

  async createBookingAttempt(input: NewBookingAttempt): Promise<CreateBookingAttemptResult> {
    // Synchronous check-and-set models the database's unique(idempotency_key)
    // constraint: no `await` between the lookup and the insert, so two
    // concurrent calls cannot both observe "absent" and both insert.
    for (const row of this.bookings.values()) {
      if (row.idempotency_key === input.idempotencyKey) {
        return { attempt: row, created: false };
      }
    }

    const id = crypto.randomUUID();
    const ts = nowIso();
    const row: BookingAttemptRow = {
      id,
      trip_request_id: input.tripRequestId,
      supplier_offer_id: input.supplierOfferId,
      idempotency_key: input.idempotencyKey,
      status: 'CREATED',
      quoted_amount: input.quotedAmount,
      confirmed_amount: null,
      currency: input.currency,
      supplier_order_id: null,
      booking_reference: null,
      supplier_http_status: null,
      supplier_response: null,
      error: null,
      created_at: ts,
      updated_at: ts,
    };
    this.bookings.set(id, row);
    return { attempt: row, created: true };
  }

  async getBookingAttempt(id: string): Promise<BookingAttemptRow | null> {
    return this.bookings.get(id) ?? null;
  }

  async getBookingAttemptByIdempotencyKey(key: string): Promise<BookingAttemptRow | null> {
    for (const row of this.bookings.values()) {
      if (row.idempotency_key === key) return row;
    }
    return null;
  }

  async updateBookingAttempt(
    id: string,
    to: BookingStatus,
    patch?: Partial<
      Pick<
        BookingAttemptRow,
        | 'confirmed_amount'
        | 'currency'
        | 'supplier_order_id'
        | 'booking_reference'
        | 'supplier_http_status'
        | 'supplier_response'
        | 'error'
      >
    >,
  ): Promise<BookingAttemptRow> {
    const current = this.bookings.get(id);
    if (!current)
      throw new ApiError('NOT_FOUND', 'Booking attempt not found.', { retryable: false });
    assertBookingTransition(current.status, to);
    const updated: BookingAttemptRow = { ...current, ...patch, status: to, updated_at: nowIso() };
    this.bookings.set(id, updated);
    return updated;
  }

  async insertAuditEvent(input: AuditEventInput): Promise<void> {
    this.auditEvents.push({
      id: ++this.auditSeq,
      trip_request_id: input.tripRequestId ?? null,
      booking_attempt_id: input.bookingAttemptId ?? null,
      event_type: input.eventType,
      event_data: input.eventData ?? {},
      created_at: nowIso(),
    });
  }
}
