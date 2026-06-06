/**
 * Supabase-backed implementation of TripRepository. State transitions are
 * validated against the state machine before writes. Unique-key races on
 * booking idempotency are caught and resolved by returning the existing row.
 */
import '@/lib/server/assert-server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdmin, databaseError } from './supabase-admin';
import type {
  AuditEventInput,
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

const PG_UNIQUE_VIOLATION = '23505';

export class SupabaseRepository implements TripRepository {
  constructor(private readonly db: SupabaseClient = getSupabaseAdmin()) {}

  async createTripRequest(input: NewTripRequest): Promise<TripRequestRow> {
    const { data, error } = await this.db
      .from('trip_requests')
      .insert({
        status: input.status,
        origin: input.origin,
        destination: input.destination,
        departure_date: input.departureDate,
        return_date: input.returnDate,
        adults: 1,
        cabin_class: input.cabinClass,
        max_connections: input.maxConnections,
      })
      .select('*')
      .single();
    if (error || !data) throw databaseError('Failed to create trip request.', error);
    return data as TripRequestRow;
  }

  async getTripRequest(id: string): Promise<TripRequestRow | null> {
    const { data, error } = await this.db
      .from('trip_requests')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw databaseError('Failed to read trip request.', error);
    return (data as TripRequestRow | null) ?? null;
  }

  async updateTripStatus(
    id: string,
    to: TripStatus,
    patch?: Partial<Pick<TripRequestRow, 'supplier_request_id' | 'error'>>,
  ): Promise<TripRequestRow> {
    const current = await this.getTripRequest(id);
    if (!current) throw new ApiError('NOT_FOUND', 'Trip request not found.', { retryable: false });
    assertTripTransition(current.status, to);

    const { data, error } = await this.db
      .from('trip_requests')
      .update({ status: to, ...patch })
      .eq('id', id)
      .select('*')
      .single();
    if (error || !data) throw databaseError('Failed to update trip status.', error);
    return data as TripRequestRow;
  }

  async insertOffers(tripRequestId: string, offers: NewFlightOffer[]): Promise<void> {
    if (offers.length === 0) return;
    const rows = offers.map((o) => ({
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
      score: o.score,
      departure_at: o.departureAt,
      final_arrival_at: o.finalArrivalAt,
      expires_at: o.expiresAt,
      raw: o.raw,
    }));
    const { error } = await this.db
      .from('flight_offers')
      .upsert(rows, { onConflict: 'trip_request_id,supplier_offer_id' });
    if (error) throw databaseError('Failed to persist offers.', error);
  }

  async getOffers(tripRequestId: string): Promise<FlightOfferRow[]> {
    const { data, error } = await this.db
      .from('flight_offers')
      .select('*')
      .eq('trip_request_id', tripRequestId)
      .order('score', { ascending: false });
    if (error) throw databaseError('Failed to read offers.', error);
    return (data as FlightOfferRow[] | null) ?? [];
  }

  async getOffer(tripRequestId: string, supplierOfferId: string): Promise<FlightOfferRow | null> {
    const { data, error } = await this.db
      .from('flight_offers')
      .select('*')
      .eq('trip_request_id', tripRequestId)
      .eq('supplier_offer_id', supplierOfferId)
      .maybeSingle();
    if (error) throw databaseError('Failed to read offer.', error);
    return (data as FlightOfferRow | null) ?? null;
  }

  async updateOffer(
    tripRequestId: string,
    supplierOfferId: string,
    patch: Partial<Pick<FlightOfferRow, 'total_amount' | 'currency' | 'expires_at' | 'raw'>>,
  ): Promise<FlightOfferRow> {
    const { data, error } = await this.db
      .from('flight_offers')
      .update(patch)
      .eq('trip_request_id', tripRequestId)
      .eq('supplier_offer_id', supplierOfferId)
      .select('*')
      .single();
    if (error || !data) throw databaseError('Failed to update offer.', error);
    return data as FlightOfferRow;
  }

  async createBookingAttempt(input: NewBookingAttempt): Promise<CreateBookingAttemptResult> {
    const { data, error } = await this.db
      .from('booking_attempts')
      .insert({
        trip_request_id: input.tripRequestId,
        supplier_offer_id: input.supplierOfferId,
        idempotency_key: input.idempotencyKey,
        status: 'CREATED',
        quoted_amount: input.quotedAmount,
        currency: input.currency,
      })
      .select('*')
      .single();

    if (!error && data) {
      return { attempt: data as BookingAttemptRow, created: true };
    }

    // Unique violation → another request already created this attempt.
    if (error && (error as { code?: string }).code === PG_UNIQUE_VIOLATION) {
      const existing = await this.getBookingAttemptByIdempotencyKey(input.idempotencyKey);
      if (existing) return { attempt: existing, created: false };
    }

    throw databaseError('Failed to create booking attempt.', error);
  }

  async getBookingAttempt(id: string): Promise<BookingAttemptRow | null> {
    const { data, error } = await this.db
      .from('booking_attempts')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw databaseError('Failed to read booking attempt.', error);
    return (data as BookingAttemptRow | null) ?? null;
  }

  async getBookingAttemptByIdempotencyKey(key: string): Promise<BookingAttemptRow | null> {
    const { data, error } = await this.db
      .from('booking_attempts')
      .select('*')
      .eq('idempotency_key', key)
      .maybeSingle();
    if (error) throw databaseError('Failed to read booking attempt.', error);
    return (data as BookingAttemptRow | null) ?? null;
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
    const current = await this.getBookingAttempt(id);
    if (!current)
      throw new ApiError('NOT_FOUND', 'Booking attempt not found.', { retryable: false });
    assertBookingTransition(current.status, to);

    const { data, error } = await this.db
      .from('booking_attempts')
      .update({ status: to, ...patch })
      .eq('id', id)
      .select('*')
      .single();
    if (error || !data) throw databaseError('Failed to update booking attempt.', error);
    return data as BookingAttemptRow;
  }

  async insertAuditEvent(input: AuditEventInput): Promise<void> {
    const { error } = await this.db.from('audit_events').insert({
      trip_request_id: input.tripRequestId ?? null,
      booking_attempt_id: input.bookingAttemptId ?? null,
      event_type: input.eventType,
      event_data: input.eventData ?? {},
    });
    if (error) throw databaseError('Failed to write audit event.', error);
  }
}
