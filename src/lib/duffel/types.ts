/**
 * Supplier (Duffel) raw types and the supplier-agnostic FlightSupplier contract.
 *
 * The raw shapes below are a deliberately small subset of the Duffel API v2
 * offer/order resources — only the fields this MVP consumes. Both the real
 * Duffel client and the mock client return these shapes, so route logic never
 * branches on the provider.
 */
import type { CabinClass, PassengerInput } from '@/types/domain';

export interface DuffelCarrier {
  name: string;
  iata_code?: string | null;
}

export interface DuffelSegment {
  departing_at: string;
  arriving_at: string;
  duration?: string | null;
  marketing_carrier?: DuffelCarrier | null;
  operating_carrier?: DuffelCarrier | null;
}

export interface DuffelSlice {
  duration?: string | null;
  segments: DuffelSegment[];
}

export interface DuffelOfferPassenger {
  id: string;
  type?: string;
}

/** Subset of a Duffel offer resource. */
export interface SupplierOffer {
  id: string;
  total_amount: string;
  total_currency: string;
  expires_at: string;
  passenger_identity_documents_required?: boolean | null;
  owner?: DuffelCarrier | null;
  passengers: DuffelOfferPassenger[];
  slices: DuffelSlice[];
}

/** Subset of a Duffel order resource. */
export interface SupplierOrder {
  id: string;
  booking_reference?: string | null;
  /** Duffel orders are "pending" or "confirmed" depending on airline timing. */
  status?: string | null;
  total_amount?: string | null;
  total_currency?: string | null;
}

export interface SearchInput {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate: string;
  cabinClass: CabinClass;
  maxConnections: 0 | 1 | 2;
  passengerCount: number;
}

export interface SearchResult {
  offers: SupplierOffer[];
  supplierRequestId: string | null;
}

export interface CreateOrderInput {
  offerId: string;
  passengerId: string;
  amount: string;
  currency: string;
  passenger: PassengerInput;
  /** Supplier-level idempotency key (sent to Duffel where supported). */
  idempotencyKey: string;
}

export type CreateOrderOutcome = 'confirmed' | 'pending' | 'failed';

export interface CreateOrderResult {
  outcome: CreateOrderOutcome;
  httpStatus: number;
  supplierOrderId: string | null;
  bookingReference: string | null;
  /** Already-safe subset of the supplier response (no PII). */
  safeResponse: Record<string, unknown>;
  errorCode?: string;
  errorMessage?: string;
}

/**
 * Provider abstraction. Implemented by both the real Duffel client and the
 * deterministic mock client so routes can be tested without credentials.
 */
export interface FlightSupplier {
  readonly name: string;
  readonly isMock: boolean;
  search(input: SearchInput): Promise<SearchResult>;
  getOffer(offerId: string): Promise<SupplierOffer>;
  createOrder(input: CreateOrderInput): Promise<CreateOrderResult>;
  getOrder?(orderId: string): Promise<SupplierOrder>;
}
