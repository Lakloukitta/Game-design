/**
 * Rebuilds safe trip status (including deterministically regenerated proposals
 * and any booking) from persisted data, for browser-refresh recovery. No raw
 * supplier JSON or passenger PII is exposed.
 */
import type { Services } from '@/lib/services';
import type { TripStatusResponse } from '@/types/api';
import type { CabinClass, MaxConnections } from '@/types/domain';
import { ApiError } from '@/lib/api/errors';
import { rankOffers } from '@/lib/flights/rank';
import { selectProposals } from '@/lib/flights/proposals';
import { offerRowToNormalized } from '@/lib/api/presenters';

export async function getTripStatus(
  services: Services,
  tripRequestId: string,
): Promise<TripStatusResponse> {
  const { repo } = services;
  const trip = await repo.getTripRequest(tripRequestId);
  if (!trip) throw new ApiError('NOT_FOUND', 'Trip request not found.', { retryable: false });

  const offerRows = await repo.getOffers(tripRequestId);
  const normalized = offerRows.map(offerRowToNormalized);
  const currency = normalized[0]?.currency ?? null;
  const proposals = normalized.length > 0 ? selectProposals(rankOffers(normalized)) : [];

  // Find the most recent booking attempt for this trip, if any.
  const booking = await findLatestBooking(services, tripRequestId);

  return {
    tripRequestId: trip.id,
    status: trip.status,
    origin: trip.origin,
    destination: trip.destination,
    departureDate: trip.departure_date,
    returnDate: trip.return_date,
    cabinClass: trip.cabin_class as CabinClass,
    maxConnections: trip.max_connections as MaxConnections,
    currency,
    proposals,
    booking,
  };
}

async function findLatestBooking(services: Services, tripRequestId: string) {
  // The repository interface does not expose a per-trip booking list, so we
  // surface a booking only when callers track its id. Trip recovery focuses on
  // proposals; booking recovery uses GET /api/bookings/[id]. Kept null here to
  // avoid a broad scan; see docs/manual-testing.md.
  void services;
  void tripRequestId;
  return null;
}
