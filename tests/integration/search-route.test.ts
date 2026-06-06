import { describe, expect, it } from 'vitest';
import { runSearch } from '@/lib/flows/search';
import { isApiError } from '@/lib/api/errors';
import type { FlightSupplier, SearchResult } from '@/lib/duffel/types';
import { MockDuffelClient } from '@/lib/mock/mock-duffel-client';
import { makeTestServices, SAMPLE_SEARCH } from '../helpers/services';

function supplierReturning(result: SearchResult | (() => never)): FlightSupplier {
  const base = new MockDuffelClient();
  return {
    name: 'test',
    isMock: true,
    search: async () => (typeof result === 'function' ? result() : result),
    getOffer: base.getOffer.bind(base),
    createOrder: base.createOrder.bind(base),
  };
}

describe('runSearch', () => {
  it('produces up to three distinct proposals and persists offers', async () => {
    const services = makeTestServices();
    const result = await runSearch(services, SAMPLE_SEARCH);

    expect(result.proposals.length).toBeGreaterThanOrEqual(1);
    expect(result.proposals.length).toBeLessThanOrEqual(3);
    expect(new Set(result.proposals.map((p) => p.offerId)).size).toBe(result.proposals.length);
    expect(result.currency).toBe('GBP');

    const trip = await services.repo.getTripRequest(result.tripRequestId);
    expect(trip?.status).toBe('PROPOSAL_READY');
    const offers = await services.repo.getOffers(result.tripRequestId);
    expect(offers.length).toBe(result.offerCount);

    const events = services.repo.auditEvents.map((e) => e.event_type);
    expect(events).toContain('FLIGHT_SEARCH_STARTED');
    expect(events).toContain('FLIGHT_PROPOSALS_CREATED');
  });

  it('does not leak raw supplier payload in the response', async () => {
    const services = makeTestServices();
    const result = await runSearch(services, SAMPLE_SEARCH);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('"raw"');
    expect(serialized).not.toContain('slices');
  });

  it('fails cleanly when no valid offers are returned', async () => {
    const services = makeTestServices(
      supplierReturning({ offers: [], supplierRequestId: 'orq_empty' }),
    );
    await expect(runSearch(services, SAMPLE_SEARCH)).rejects.toSatisfy(
      (e: unknown) => isApiError(e) && e.code === 'NOT_FOUND',
    );
  });

  it('surfaces a supplier timeout as a controlled error and marks the trip FAILED', async () => {
    const services = makeTestServices(
      supplierReturning(() => {
        throw Object.assign(new Error('timeout'), { status: 504 });
      }),
    );
    await expect(runSearch(services, SAMPLE_SEARCH)).rejects.toSatisfy(
      (e: unknown) => isApiError(e) && e.code === 'SUPPLIER_TIMEOUT',
    );
    const trips = [...services.repo.trips.values()];
    expect(trips[0]?.status).toBe('FAILED');
  });

  it('surfaces a supplier validation failure as a controlled error', async () => {
    const services = makeTestServices(
      supplierReturning(() => {
        throw Object.assign(new Error('bad request'), { status: 400, retryable: false });
      }),
    );
    await expect(runSearch(services, SAMPLE_SEARCH)).rejects.toSatisfy(
      (e: unknown) => isApiError(e) && e.code === 'SUPPLIER_ERROR',
    );
  });
});
