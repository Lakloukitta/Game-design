import { describe, expect, it } from 'vitest';
import { normalizeOffer, normalizeOffers, OfferNormalizationError } from '@/lib/flights/normalize';
import { buildMockOffer } from '@/lib/mock/fixtures';

const ctx = {
  origin: 'LHR',
  destination: 'JFK',
  departureDate: '2030-01-10',
  returnDate: '2030-01-17',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rawOffer(over: Record<string, unknown> = {}): any {
  return {
    id: 'off_x',
    total_amount: '420.00',
    total_currency: 'gbp',
    expires_at: '2030-01-10T09:00:00Z',
    owner: { name: 'Test Air', iata_code: 'TA' },
    passengers: [{ id: 'pas_1', type: 'adult' }],
    slices: [
      {
        duration: 'PT8H30M',
        segments: [
          {
            departing_at: '2030-01-10T08:00:00Z',
            arriving_at: '2030-01-10T11:00:00Z',
            marketing_carrier: { name: 'Test Air' },
            operating_carrier: { name: 'Test Air' },
          },
          {
            departing_at: '2030-01-10T12:00:00Z',
            arriving_at: '2030-01-10T16:30:00Z',
            marketing_carrier: { name: 'Test Air' },
            operating_carrier: { name: 'Partner Regional' },
          },
        ],
      },
      {
        duration: 'PT7H50M',
        segments: [
          {
            departing_at: '2030-01-17T10:00:00Z',
            arriving_at: '2030-01-17T17:50:00Z',
            marketing_carrier: { name: 'Test Air' },
            operating_carrier: { name: 'Test Air' },
          },
        ],
      },
    ],
    ...over,
  };
}

describe('normalizeOffer', () => {
  it('sums slice durations and computes max stops across slices', () => {
    const offer = normalizeOffer(rawOffer());
    expect(offer.durationMinutes).toBe(8 * 60 + 30 + 7 * 60 + 50);
    expect(offer.maxStops).toBe(1); // outbound has 2 segments → 1 stop
  });

  it('preserves the exact amount text and uppercases currency', () => {
    const offer = normalizeOffer(rawOffer());
    expect(offer.amountText).toBe('420.00');
    expect(offer.totalAmount).toBe(420);
    expect(offer.currency).toBe('GBP');
  });

  it('deduplicates operating carriers and keeps marketing separate', () => {
    const offer = normalizeOffer(rawOffer());
    expect(offer.operatingCarriers).toEqual(['Test Air', 'Partner Regional']);
    expect(offer.marketingCarriers).toEqual(['Test Air']);
  });

  it('preserves the expiry and sets departure/final arrival', () => {
    const offer = normalizeOffer(rawOffer());
    expect(offer.expiresAt).toBe('2030-01-10T09:00:00Z');
    expect(offer.departureAt).toBe('2030-01-10T08:00:00Z');
    expect(offer.finalArrivalAt).toBe('2030-01-17T17:50:00Z');
  });

  it('falls back to segment timestamps when slice duration is missing', () => {
    const raw = rawOffer();
    raw.slices[0]!.duration = null;
    raw.slices[1]!.duration = null;
    const offer = normalizeOffer(raw);
    // Outbound 08:00→16:30 = 510m; return 10:00→17:50 = 470m.
    expect(offer.durationMinutes).toBe(510 + 470);
  });

  it('rejects an invalid (non-positive) price', () => {
    expect(() => normalizeOffer(rawOffer({ total_amount: '0.00' }))).toThrow(
      OfferNormalizationError,
    );
  });

  it('rejects a malformed offer (missing slices)', () => {
    expect(() => normalizeOffer({ id: 'x', total_amount: '1', total_currency: 'GBP' })).toThrow(
      OfferNormalizationError,
    );
  });
});

describe('normalizeOffers', () => {
  it('selects the dominant currency and excludes mismatches', () => {
    const result = normalizeOffers([
      rawOffer({ id: 'a', total_currency: 'GBP' }),
      rawOffer({ id: 'b', total_currency: 'GBP' }),
      rawOffer({ id: 'c', total_currency: 'USD' }),
    ]);
    expect(result.currency).toBe('GBP');
    expect(result.offers).toHaveLength(2);
    expect(result.currencyMismatchCount).toBe(1);
  });

  it('collects malformed offers into the rejected list', () => {
    const result = normalizeOffers([rawOffer({ id: 'ok' }), { id: 'bad' }]);
    expect(result.offers).toHaveLength(1);
    expect(result.rejected).toHaveLength(1);
  });

  it('normalizes the mock fixtures end to end', () => {
    const offer = normalizeOffer(
      buildMockOffer(
        {
          id: 'off_mock_best',
          amount: '462.30',
          outboundSegments: 2,
          returnSegments: 1,
          outboundDurationMin: 510,
          returnDurationMin: 470,
          expiresInMinutes: 30,
        },
        ctx,
      ),
    );
    expect(offer.durationMinutes).toBe(980);
    expect(offer.maxStops).toBe(1);
  });
});
