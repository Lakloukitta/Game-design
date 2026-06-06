import { describe, expect, it } from 'vitest';
import { runSearch } from '@/lib/flows/search';
import { runRevalidate } from '@/lib/flows/revalidate';
import { runBooking } from '@/lib/flows/booking';
import { isApiError } from '@/lib/api/errors';
import { MockDuffelClient } from '@/lib/mock/mock-duffel-client';
import {
  makeTestServices,
  SAMPLE_PASSENGER,
  SAMPLE_SEARCH,
  supplierWithGetOffer,
  type TestServices,
} from '../helpers/services';

async function approved(offerId: string): Promise<{
  services: TestServices;
  tripId: string;
  amount: string;
  currency: string;
}> {
  const services = makeTestServices();
  const { tripRequestId: tripId } = await runSearch(services, SAMPLE_SEARCH);
  const stored = await services.repo.getOffer(tripId, offerId);
  const res = await runRevalidate(services, {
    tripRequestId: tripId,
    offerId,
    previouslyDisplayedAmount: stored!.total_amount,
    previouslyDisplayedCurrency: stored!.currency,
  });
  return { services, tripId, amount: res.currentAmount, currency: res.currency };
}

function bookingReq(
  tripId: string,
  offerId: string,
  amount: string,
  currency: string,
  key: string,
) {
  return {
    tripRequestId: tripId,
    offerId,
    checkoutAttemptId: key,
    acceptedAmount: amount,
    acceptedCurrency: currency,
    passenger: SAMPLE_PASSENGER,
  };
}

describe('runBooking', () => {
  it('creates a confirmed sandbox order', async () => {
    const { services, tripId, amount, currency } = await approved('off_mock_best');
    const key = crypto.randomUUID();
    const result = await runBooking(
      services,
      bookingReq(tripId, 'off_mock_best', amount, currency, key),
    );
    expect(result.status).toBe('CONFIRMED');
    expect(result.bookingReference).toBeTruthy();
    const trip = await services.repo.getTripRequest(tripId);
    expect(trip?.status).toBe('CONFIRMED');
  });

  it('represents a pending supplier order distinctly', async () => {
    const { services, tripId, amount, currency } = await approved('off_mock_pending');
    const result = await runBooking(
      services,
      bookingReq(tripId, 'off_mock_pending', amount, currency, crypto.randomUUID()),
    );
    expect(result.status).toBe('PENDING_SUPPLIER');
    const trip = await services.repo.getTripRequest(tripId);
    expect(trip?.status).toBe('PENDING_SUPPLIER');
  });

  it('represents a failed supplier order', async () => {
    const { services, tripId, amount, currency } = await approved('off_mock_fail');
    const result = await runBooking(
      services,
      bookingReq(tripId, 'off_mock_fail', amount, currency, crypto.randomUUID()),
    );
    expect(result.status).toBe('FAILED');
    expect(result.error?.code).toBeTruthy();
  });

  it('returns 409 PRICE_CHANGED when the amount differs from the approved amount', async () => {
    const { services, tripId, currency } = await approved('off_mock_best');
    await expect(
      runBooking(
        services,
        bookingReq(tripId, 'off_mock_best', '999.00', currency, crypto.randomUUID()),
      ),
    ).rejects.toSatisfy(
      (e: unknown) => isApiError(e) && e.code === 'PRICE_CHANGED' && e.status === 409,
    );
    const trip = await services.repo.getTripRequest(tripId);
    expect(trip?.status).toBe('PRICE_CHANGED');
  });

  it('returns 422 when identity documents are required', async () => {
    const { services, tripId, amount, currency } = await approved('off_mock_docs');
    await expect(
      runBooking(
        services,
        bookingReq(tripId, 'off_mock_docs', amount, currency, crypto.randomUUID()),
      ),
    ).rejects.toSatisfy(
      (e: unknown) => isApiError(e) && e.code === 'DOCUMENTS_REQUIRED' && e.status === 422,
    );
  });

  it('returns 409 OFFER_EXPIRED when the offer expired before booking', async () => {
    // Reach APPROVED with a normal offer, then book against a supplier whose
    // re-fetch reports the offer as expired.
    const { services, tripId, amount, currency } = await approved('off_mock_best');
    const expiredSupplier = supplierWithGetOffer(async (id) => {
      const base = await new MockDuffelClient().getOffer('off_mock_best');
      return { ...base, id, expires_at: new Date(Date.now() - 60_000).toISOString() };
    });
    await expect(
      runBooking(
        { ...services, supplier: expiredSupplier },
        bookingReq(tripId, 'off_mock_best', amount, currency, crypto.randomUUID()),
      ),
    ).rejects.toSatisfy((e: unknown) => isApiError(e) && e.code === 'OFFER_EXPIRED');
  });

  it('rejects an offer that does not belong to the trip', async () => {
    const { services, tripId, amount, currency } = await approved('off_mock_best');
    await expect(
      runBooking(
        services,
        bookingReq(tripId, 'off_not_here', amount, currency, crypto.randomUUID()),
      ),
    ).rejects.toSatisfy((e: unknown) => isApiError(e) && e.code === 'NOT_FOUND');
  });

  it('rejects booking from an illegal (non-approved) trip state', async () => {
    const services = makeTestServices();
    const { tripRequestId: tripId } = await runSearch(services, SAMPLE_SEARCH);
    // Trip is PROPOSAL_READY, not APPROVED.
    await expect(
      runBooking(
        services,
        bookingReq(tripId, 'off_mock_best', '462.30', 'GBP', crypto.randomUUID()),
      ),
    ).rejects.toSatisfy((e: unknown) => isApiError(e) && e.code === 'STATE_CONFLICT');
  });

  it('never persists passenger PII and never returns raw supplier payloads', async () => {
    const { services, tripId, amount, currency } = await approved('off_mock_best');
    const result = await runBooking(
      services,
      bookingReq(tripId, 'off_mock_best', amount, currency, crypto.randomUUID()),
    );

    const persisted = JSON.stringify([
      [...services.repo.bookings.values()],
      services.repo.auditEvents,
    ]);
    expect(persisted).not.toContain(SAMPLE_PASSENGER.email);
    expect(persisted).not.toContain(SAMPLE_PASSENGER.familyName);
    expect(persisted).not.toContain(SAMPLE_PASSENGER.phoneNumber);

    const response = JSON.stringify(result);
    expect(response).not.toContain('slices');
    expect(response).not.toContain('"raw"');
  });
});
