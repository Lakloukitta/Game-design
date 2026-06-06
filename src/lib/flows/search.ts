/**
 * Search orchestration: validate → create trip → call supplier → normalize →
 * filter → rank → select proposals → persist → return safe proposals.
 * Pure of HTTP concerns so it can be integration-tested with injected fakes.
 */
import type { Services } from '@/lib/services';
import type { SearchResponse } from '@/types/api';
import type { TripSearchInput } from '@/types/domain';
import { ApiError } from '@/lib/api/errors';
import { logger } from '@/lib/logging/logger';
import { normalizeOffers } from '@/lib/flights/normalize';
import { rankOffers } from '@/lib/flights/rank';
import { selectProposals } from '@/lib/flights/proposals';
import type { NewFlightOffer } from '@/lib/database/types';

export async function runSearch(
  services: Services,
  input: TripSearchInput,
): Promise<SearchResponse> {
  const { repo, supplier } = services;

  const trip = await repo.createTripRequest({
    origin: input.origin,
    destination: input.destination,
    departureDate: input.departureDate,
    returnDate: input.returnDate,
    cabinClass: input.cabinClass,
    maxConnections: input.maxConnections,
    status: 'SEARCHING',
  });

  await repo.insertAuditEvent({
    tripRequestId: trip.id,
    eventType: 'FLIGHT_SEARCH_STARTED',
    eventData: {
      origin: input.origin,
      destination: input.destination,
      cabinClass: input.cabinClass,
      maxConnections: input.maxConnections,
      mock: supplier.isMock,
    },
  });

  let supplierResult;
  try {
    supplierResult = await supplier.search({
      origin: input.origin,
      destination: input.destination,
      departureDate: input.departureDate,
      returnDate: input.returnDate,
      cabinClass: input.cabinClass,
      maxConnections: input.maxConnections,
      passengerCount: 1,
    });
  } catch (error) {
    await failTrip(services, trip.id, 'SUPPLIER_ERROR', 'Flight search failed at the supplier.');
    throw asApiError(error);
  }

  const normalized = normalizeOffers(supplierResult.offers);

  if (normalized.rejected.length > 0 || normalized.currencyMismatchCount > 0) {
    logger.info('Search filtered some offers', {
      tripRequestId: trip.id,
      rejected: normalized.rejected.length,
      currencyMismatch: normalized.currencyMismatchCount,
    });
  }

  if (normalized.offers.length === 0 || !normalized.currency) {
    await failTrip(
      services,
      trip.id,
      'NOT_FOUND',
      'No valid flight offers were returned for this search.',
    );
    throw new ApiError('NOT_FOUND', 'No valid flight offers were found for this search.', {
      retryable: false,
    });
  }

  const scored = rankOffers(normalized.offers);
  const proposals = selectProposals(scored);

  const offerRows: NewFlightOffer[] = scored.map((offer) => ({
    supplierOfferId: offer.offerId,
    airlineName: offer.airlineName,
    marketingCarriers: offer.marketingCarriers,
    operatingCarriers: offer.operatingCarriers,
    totalAmount: offer.amountText,
    currency: offer.currency,
    durationMinutes: offer.durationMinutes,
    maxStops: offer.maxStops,
    score: offer.score,
    departureAt: offer.departureAt,
    finalArrivalAt: offer.finalArrivalAt,
    expiresAt: offer.expiresAt,
    raw: offer.raw,
  }));

  await repo.insertOffers(trip.id, offerRows);
  await repo.updateTripStatus(trip.id, 'PROPOSAL_READY', {
    supplier_request_id: supplierResult.supplierRequestId,
  });
  await repo.insertAuditEvent({
    tripRequestId: trip.id,
    eventType: 'FLIGHT_PROPOSALS_CREATED',
    eventData: {
      offerCount: scored.length,
      currency: normalized.currency,
      proposalLabels: proposals.map((p) => p.label),
    },
  });

  return {
    tripRequestId: trip.id,
    offerCount: scored.length,
    currency: normalized.currency,
    proposals,
  };
}

async function failTrip(
  services: Services,
  tripId: string,
  code: string,
  message: string,
): Promise<void> {
  try {
    await services.repo.updateTripStatus(tripId, 'FAILED', { error: { code, message } });
    await services.repo.insertAuditEvent({
      tripRequestId: tripId,
      eventType: 'FLIGHT_SEARCH_FAILED',
      eventData: { code },
    });
  } catch (error) {
    logger.error('Failed to mark trip FAILED', { tripId, error: String(error) });
  }
}

function asApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  const status = (error as { status?: number }).status;
  const retryable = (error as { retryable?: boolean }).retryable ?? true;
  if (status === 504) {
    return new ApiError('SUPPLIER_TIMEOUT', 'The flight supplier timed out.', { retryable: true });
  }
  return new ApiError('SUPPLIER_ERROR', 'The flight supplier could not complete the search.', {
    retryable,
    internalCause: error,
  });
}
