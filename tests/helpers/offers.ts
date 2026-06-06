import type { NormalizedOffer } from '@/types/domain';

export function makeOffer(overrides: Partial<NormalizedOffer> = {}): NormalizedOffer {
  return {
    offerId: overrides.offerId ?? 'off_1',
    airlineName: 'Test Air',
    marketingCarriers: ['Test Air'],
    operatingCarriers: ['Test Air'],
    totalAmount: 500,
    amountText: '500.00',
    currency: 'GBP',
    durationMinutes: 600,
    maxStops: 1,
    departureAt: '2030-01-10T08:00:00Z',
    finalArrivalAt: '2030-01-17T18:00:00Z',
    expiresAt: '2030-01-10T09:00:00Z',
    passengerIdentityDocumentsRequired: false,
    score: 0,
    raw: {},
    ...overrides,
  };
}
