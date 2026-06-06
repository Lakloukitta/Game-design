/**
 * Presenters convert internal DB rows / normalized offers into the narrow,
 * browser-safe API response shapes. They never include raw supplier JSON or
 * passenger PII.
 */
import type { BookingStatusResponse, RevalidateResponse } from '@/types/api';
import type { BookingAttemptRow, FlightOfferRow } from '@/lib/database/types';
import type { NormalizedOffer } from '@/types/domain';

export function bookingAttemptToResponse(row: BookingAttemptRow): BookingStatusResponse {
  return {
    bookingAttemptId: row.id,
    tripRequestId: row.trip_request_id,
    status: row.status,
    acceptedAmount: row.quoted_amount,
    confirmedAmount: row.confirmed_amount,
    currency: row.currency,
    supplierOrderId: row.supplier_order_id,
    bookingReference: row.booking_reference,
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Reconstructs a NormalizedOffer from a stored offer row (used by the
 * trip-status recovery endpoint to deterministically regenerate proposals).
 * Raw supplier JSON is intentionally dropped here so it never leaves the server.
 */
export function offerRowToNormalized(row: FlightOfferRow): NormalizedOffer {
  return {
    offerId: row.supplier_offer_id,
    airlineName: row.airline_name,
    marketingCarriers: row.marketing_carriers,
    operatingCarriers: row.operating_carriers,
    totalAmount: Number(row.total_amount),
    amountText: row.total_amount,
    currency: row.currency,
    durationMinutes: row.duration_minutes,
    maxStops: row.max_stops,
    departureAt: row.departure_at ?? '',
    finalArrivalAt: row.final_arrival_at ?? '',
    expiresAt: row.expires_at,
    passengerIdentityDocumentsRequired: false,
    score: Number(row.score),
    raw: null,
  };
}

export function normalizedToOfferRowPatch(offer: NormalizedOffer): Partial<FlightOfferRow> {
  return {
    total_amount: offer.amountText,
    currency: offer.currency,
    expires_at: offer.expiresAt,
    raw: offer.raw,
  };
}

export function buildRevalidateResponse(args: {
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
}): RevalidateResponse {
  return { ...args };
}
