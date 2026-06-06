import { describe, expect, it, vi } from 'vitest';
import { runSearch } from '@/lib/flows/search';
import { runRevalidate } from '@/lib/flows/revalidate';
import { runBooking } from '@/lib/flows/booking';
import { MockDuffelClient } from '@/lib/mock/mock-duffel-client';
import {
  makeTestServices,
  SAMPLE_PASSENGER,
  SAMPLE_SEARCH,
  type TestServices,
} from '../helpers/services';

async function approvedServices(supplier: MockDuffelClient): Promise<{
  services: TestServices;
  tripId: string;
  amount: string;
  currency: string;
}> {
  const services = { ...makeTestServices(supplier), supplier } as TestServices;
  // makeTestServices created its own repo; rebuild with the injected supplier.
  const { tripRequestId: tripId } = await runSearch(services, SAMPLE_SEARCH);
  const stored = await services.repo.getOffer(tripId, 'off_mock_best');
  const res = await runRevalidate(services, {
    tripRequestId: tripId,
    offerId: 'off_mock_best',
    previouslyDisplayedAmount: stored!.total_amount,
    previouslyDisplayedCurrency: stored!.currency,
  });
  return { services, tripId, amount: res.currentAmount, currency: res.currency };
}

function req(tripId: string, amount: string, currency: string, key: string) {
  return {
    tripRequestId: tripId,
    offerId: 'off_mock_best',
    checkoutAttemptId: key,
    acceptedAmount: amount,
    acceptedCurrency: currency,
    passenger: SAMPLE_PASSENGER,
  };
}

describe('booking idempotency', () => {
  it('returns the existing attempt for the same key without a second supplier call', async () => {
    const supplier = new MockDuffelClient();
    const createSpy = vi.spyOn(supplier, 'createOrder');
    const { services, tripId, amount, currency } = await approvedServices(supplier);
    const key = crypto.randomUUID();

    const first = await runBooking(services, req(tripId, amount, currency, key));
    const second = await runBooking(services, req(tripId, amount, currency, key));

    expect(second.bookingAttemptId).toBe(first.bookingAttemptId);
    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(services.repo.bookings.size).toBe(1);
  });

  it('makes exactly one supplier call for concurrent duplicate submissions', async () => {
    const supplier = new MockDuffelClient();
    const createSpy = vi.spyOn(supplier, 'createOrder');
    const { services, tripId, amount, currency } = await approvedServices(supplier);
    const key = crypto.randomUUID();

    const [a, b] = await Promise.all([
      runBooking(services, req(tripId, amount, currency, key)),
      runBooking(services, req(tripId, amount, currency, key)),
    ]);

    expect(a.bookingAttemptId).toBe(b.bookingAttemptId);
    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(services.repo.bookings.size).toBe(1);
  });

  it('creates separate attempts for different keys', async () => {
    const supplier = new MockDuffelClient();
    const { services, tripId, amount, currency } = await approvedServices(supplier);

    const first = await runBooking(services, req(tripId, amount, currency, crypto.randomUUID()));
    // After the first confirms, the trip is CONFIRMED; a second different key on
    // the same approved decision is rejected as a state conflict, proving a new
    // key does not silently rebook a completed trip.
    await expect(
      runBooking(services, req(tripId, amount, currency, crypto.randomUUID())),
    ).rejects.toBeTruthy();
    expect(first.status).toBe('CONFIRMED');
    expect(services.repo.bookings.size).toBe(2);
  });

  it('echoes a failed attempt on retry with the same key (no second supplier call)', async () => {
    const supplier = new MockDuffelClient();
    const services = { ...makeTestServices(supplier), supplier } as TestServices;
    const { tripRequestId: tripId } = await runSearch(services, SAMPLE_SEARCH);
    const stored = await services.repo.getOffer(tripId, 'off_mock_fail');
    const rev = await runRevalidate(services, {
      tripRequestId: tripId,
      offerId: 'off_mock_fail',
      previouslyDisplayedAmount: stored!.total_amount,
      previouslyDisplayedCurrency: stored!.currency,
    });
    const key = crypto.randomUUID();
    const failReq = {
      tripRequestId: tripId,
      offerId: 'off_mock_fail',
      checkoutAttemptId: key,
      acceptedAmount: rev.currentAmount,
      acceptedCurrency: rev.currency,
      passenger: SAMPLE_PASSENGER,
    };
    const createSpy = vi.spyOn(supplier, 'createOrder');

    const first = await runBooking(services, failReq);
    const second = await runBooking(services, failReq);

    expect(first.status).toBe('FAILED');
    expect(second.status).toBe('FAILED');
    expect(second.bookingAttemptId).toBe(first.bookingAttemptId);
    expect(createSpy).toHaveBeenCalledTimes(1);
  });
});
