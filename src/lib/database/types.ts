/**
 * Database row types mirroring supabase/migrations/001_initial_schema.sql, plus
 * the repository interface used by API routes. Routes depend only on the
 * interface, so a Supabase-backed implementation and an in-memory test
 * implementation are interchangeable.
 */
import type { BookingStatus, CabinClass, MaxConnections, TripStatus } from '@/types/domain';

export interface TripRequestRow {
  id: string;
  status: TripStatus;
  origin: string;
  destination: string;
  departure_date: string;
  return_date: string;
  adults: number;
  cabin_class: CabinClass;
  max_connections: number;
  supplier_request_id: string | null;
  error: { code: string; message: string } | null;
  created_at: string;
  updated_at: string;
}

export interface FlightOfferRow {
  id: string;
  trip_request_id: string;
  supplier: string;
  supplier_offer_id: string;
  airline_name: string;
  marketing_carriers: string[];
  operating_carriers: string[];
  total_amount: string;
  currency: string;
  duration_minutes: number;
  max_stops: number;
  score: string;
  departure_at: string | null;
  final_arrival_at: string | null;
  expires_at: string;
  raw: unknown;
  created_at: string;
  updated_at: string;
}

export interface BookingAttemptRow {
  id: string;
  trip_request_id: string;
  supplier_offer_id: string;
  idempotency_key: string;
  status: BookingStatus;
  quoted_amount: string | null;
  confirmed_amount: string | null;
  currency: string | null;
  supplier_order_id: string | null;
  booking_reference: string | null;
  supplier_http_status: number | null;
  supplier_response: Record<string, unknown> | null;
  error: { code: string; message: string } | null;
  created_at: string;
  updated_at: string;
}

export interface AuditEventRow {
  id: number;
  trip_request_id: string | null;
  booking_attempt_id: string | null;
  event_type: string;
  event_data: Record<string, unknown>;
  created_at: string;
}

export interface NewTripRequest {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate: string;
  cabinClass: CabinClass;
  maxConnections: MaxConnections;
  status: TripStatus;
}

export interface NewFlightOffer {
  supplierOfferId: string;
  airlineName: string;
  marketingCarriers: string[];
  operatingCarriers: string[];
  totalAmount: string;
  currency: string;
  durationMinutes: number;
  maxStops: number;
  score: number;
  departureAt: string | null;
  finalArrivalAt: string | null;
  expiresAt: string;
  raw: unknown;
}

export interface NewBookingAttempt {
  tripRequestId: string;
  supplierOfferId: string;
  idempotencyKey: string;
  quotedAmount: string;
  currency: string;
}

export interface AuditEventInput {
  tripRequestId?: string | null;
  bookingAttemptId?: string | null;
  eventType: string;
  eventData?: Record<string, unknown>;
}

export interface CreateBookingAttemptResult {
  attempt: BookingAttemptRow;
  created: boolean;
}

/**
 * Repository contract. All persistence flows through this interface. State
 * transitions are validated inside `updateTripStatus` / `updateBookingAttempt`.
 */
export interface TripRepository {
  createTripRequest(input: NewTripRequest): Promise<TripRequestRow>;
  getTripRequest(id: string): Promise<TripRequestRow | null>;
  updateTripStatus(
    id: string,
    to: TripStatus,
    patch?: Partial<Pick<TripRequestRow, 'supplier_request_id' | 'error'>>,
  ): Promise<TripRequestRow>;

  insertOffers(tripRequestId: string, offers: NewFlightOffer[]): Promise<void>;
  getOffers(tripRequestId: string): Promise<FlightOfferRow[]>;
  getOffer(tripRequestId: string, supplierOfferId: string): Promise<FlightOfferRow | null>;
  updateOffer(
    tripRequestId: string,
    supplierOfferId: string,
    patch: Partial<Pick<FlightOfferRow, 'total_amount' | 'currency' | 'expires_at' | 'raw'>>,
  ): Promise<FlightOfferRow>;

  createBookingAttempt(input: NewBookingAttempt): Promise<CreateBookingAttemptResult>;
  getBookingAttempt(id: string): Promise<BookingAttemptRow | null>;
  getBookingAttemptByIdempotencyKey(key: string): Promise<BookingAttemptRow | null>;
  updateBookingAttempt(
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
  ): Promise<BookingAttemptRow>;

  insertAuditEvent(input: AuditEventInput): Promise<void>;
}
