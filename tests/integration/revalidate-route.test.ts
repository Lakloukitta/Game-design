import { describe, expect, it } from 'vitest';
import { runSearch } from '@/lib/flows/search';
import { runRevalidate } from '@/lib/flows/revalidate';
import { MockDuffelClient } from '@/lib/mock/mock-duffel-client';
import {
  makeTestServices,
  SAMPLE_SEARCH,
  supplierWithGetOffer,
  type TestServices,
} from '../helpers/services';

async function setup(): Promise<{ services: TestServices; tripId: string }> {
  const services = makeTestServices();
  const result = await runSearch(services, SAMPLE_SEARCH);
  return { services, tripId: result.tripRequestId };
}

async function storedAmount(services: TestServices, tripId: string, offerId: string) {
  const offer = await services.repo.getOffer(tripId, offerId);
  return { amount: offer!.total_amount, currency: offer!.currency };
}

describe('runRevalidate', () => {
  it('approves an unchanged offer', async () => {
    const { services, tripId } = await setup();
    const { amount, currency } = await storedAmount(services, tripId, 'off_mock_best');
    const res = await runRevalidate(services, {
      tripRequestId: tripId,
      offerId: 'off_mock_best',
      previouslyDisplayedAmount: amount,
      previouslyDisplayedCurrency: currency,
    });
    expect(res.changed).toBe(false);
    expect(res.expired).toBe(false);
    const trip = await services.repo.getTripRequest(tripId);
    expect(trip?.status).toBe('APPROVED');
  });

  it('detects a price increase and moves to PRICE_CHANGED', async () => {
    const { services, tripId } = await setup();
    const { amount, currency } = await storedAmount(services, tripId, 'off_mock_pricechange');
    const res = await runRevalidate(services, {
      tripRequestId: tripId,
      offerId: 'off_mock_pricechange',
      previouslyDisplayedAmount: amount,
      previouslyDisplayedCurrency: currency,
    });
    expect(res.changed).toBe(true);
    expect(Number(res.currentAmount)).toBeGreaterThan(Number(amount));
    const trip = await services.repo.getTripRequest(tripId);
    expect(trip?.status).toBe('PRICE_CHANGED');
  });

  it('detects a price decrease as a change', async () => {
    const { services, tripId } = await setup();
    const supplier = supplierWithGetOffer(async (id) => {
      const base = await new MockDuffelClient().getOffer('off_mock_best');
      return { ...base, id, total_amount: '300.00' };
    });
    const res = await runRevalidate(
      { ...services, supplier },
      {
        tripRequestId: tripId,
        offerId: 'off_mock_best',
        previouslyDisplayedAmount: '462.30',
        previouslyDisplayedCurrency: 'GBP',
      },
    );
    expect(res.changed).toBe(true);
    expect(res.currentAmount).toBe('300.00');
  });

  it('detects a currency change', async () => {
    const { services, tripId } = await setup();
    const supplier = supplierWithGetOffer(async (id) => {
      const base = await new MockDuffelClient().getOffer('off_mock_best');
      return { ...base, id, total_currency: 'USD' };
    });
    const res = await runRevalidate(
      { ...services, supplier },
      {
        tripRequestId: tripId,
        offerId: 'off_mock_best',
        previouslyDisplayedAmount: '462.30',
        previouslyDisplayedCurrency: 'GBP',
      },
    );
    expect(res.changed).toBe(true);
    expect(res.currency).toBe('USD');
  });

  it('marks an expired offer EXPIRED', async () => {
    const { services, tripId } = await setup();
    const { amount, currency } = await storedAmount(services, tripId, 'off_mock_expired');
    const res = await runRevalidate(services, {
      tripRequestId: tripId,
      offerId: 'off_mock_expired',
      previouslyDisplayedAmount: amount,
      previouslyDisplayedCurrency: currency,
    });
    expect(res.expired).toBe(true);
    const trip = await services.repo.getTripRequest(tripId);
    expect(trip?.status).toBe('EXPIRED');
  });

  it('reports an identity-document requirement', async () => {
    const { services, tripId } = await setup();
    const { amount, currency } = await storedAmount(services, tripId, 'off_mock_docs');
    const res = await runRevalidate(services, {
      tripRequestId: tripId,
      offerId: 'off_mock_docs',
      previouslyDisplayedAmount: amount,
      previouslyDisplayedCurrency: currency,
    });
    expect(res.identityDocumentsRequired).toBe(true);
  });

  it('rejects an offer that does not belong to the trip', async () => {
    const { services, tripId } = await setup();
    await expect(
      runRevalidate(services, {
        tripRequestId: tripId,
        offerId: 'off_not_here',
        previouslyDisplayedAmount: '100.00',
        previouslyDisplayedCurrency: 'GBP',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
