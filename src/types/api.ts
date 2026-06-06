/**
 * Narrow, browser-facing API response models. These never include raw supplier
 * payloads or passenger PII.
 */
import type { BookingStatus, CabinClass, MaxConnections, Proposal, TripStatus } from './domain';

export type { Proposal } from './domain';

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    retryable: boolean;
    fieldErrors?: Record<string, string[]>;
    details?: Record<string, unknown>;
    requestId?: string;
  };
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  databaseConfigured: boolean;
  duffelConfigured: boolean;
  mockMode: boolean;
  timestamp: string;
}

export interface SearchResponse {
  tripRequestId: string;
  offerCount: number;
  currency: string;
  proposals: Proposal[];
}

export interface TripStatusResponse {
  tripRequestId: string;
  status: TripStatus;
  origin: string;
  destination: string;
  departureDate: string;
  returnDate: string;
  cabinClass: CabinClass;
  maxConnections: MaxConnections;
  currency: string | null;
  proposals: Proposal[];
  booking: BookingStatusResponse | null;
}

export interface RevalidateResponse {
  tripRequestId: string;
  offerId: string;
  currentAmount: string;
  previousAmount: string;
  currency: string;
  changed: boolean;
  expired: boolean;
  available: boolean;
  identityDocumentsRequired: boolean;
  expiresAt: string;
}

export interface BookingStatusResponse {
  bookingAttemptId: string;
  tripRequestId: string;
  status: BookingStatus;
  acceptedAmount: string | null;
  confirmedAmount: string | null;
  currency: string | null;
  supplierOrderId: string | null;
  bookingReference: string | null;
  error: { code: string; message: string } | null;
  createdAt: string;
  updatedAt: string;
}
