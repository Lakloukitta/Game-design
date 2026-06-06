import { describe, expect, it } from 'vitest';
import { inverseNormalize, rankOffers, stopScore } from '@/lib/flights/rank';
import { makeOffer } from '../helpers/offers';

describe('stopScore', () => {
  it('scores nonstop, one stop, and two+ stops', () => {
    expect(stopScore(0)).toBe(1.0);
    expect(stopScore(1)).toBe(0.55);
    expect(stopScore(2)).toBe(0.1);
    expect(stopScore(3)).toBe(0.1);
  });
});

describe('inverseNormalize', () => {
  it('maps min to 1 and max to 0', () => {
    expect(inverseNormalize(100, 100, 200)).toBe(1);
    expect(inverseNormalize(200, 100, 200)).toBe(0);
    expect(inverseNormalize(150, 100, 200)).toBeCloseTo(0.5);
  });

  it('returns 1 without dividing by zero when min equals max', () => {
    expect(inverseNormalize(100, 100, 100)).toBe(1);
  });
});

describe('rankOffers', () => {
  it('gives the cheapest offer the highest price score', () => {
    const ranked = rankOffers([
      makeOffer({ offerId: 'cheap', totalAmount: 100 }),
      makeOffer({ offerId: 'mid', totalAmount: 200 }),
      makeOffer({ offerId: 'dear', totalAmount: 300 }),
    ]);
    const cheap = ranked.find((o) => o.offerId === 'cheap')!;
    const dear = ranked.find((o) => o.offerId === 'dear')!;
    expect(cheap.priceScore).toBe(1);
    expect(dear.priceScore).toBe(0);
  });

  it('gives the fastest offer the highest duration score', () => {
    const ranked = rankOffers([
      makeOffer({ offerId: 'fast', durationMinutes: 300 }),
      makeOffer({ offerId: 'slow', durationMinutes: 900 }),
    ]);
    expect(ranked.find((o) => o.offerId === 'fast')!.durationScore).toBe(1);
  });

  it('rewards nonstop flights via the stop score', () => {
    const ranked = rankOffers([
      makeOffer({ offerId: 'nonstop', maxStops: 0 }),
      makeOffer({ offerId: 'onestop', maxStops: 1 }),
    ]);
    expect(ranked.find((o) => o.offerId === 'nonstop')!.stopScore).toBe(1);
  });

  it('handles equal prices without NaN', () => {
    const ranked = rankOffers([
      makeOffer({ offerId: 'a', totalAmount: 200 }),
      makeOffer({ offerId: 'b', totalAmount: 200 }),
    ]);
    expect(ranked.every((o) => o.priceScore === 1)).toBe(true);
  });

  it('handles equal durations without NaN', () => {
    const ranked = rankOffers([
      makeOffer({ offerId: 'a', durationMinutes: 500 }),
      makeOffer({ offerId: 'b', durationMinutes: 500 }),
    ]);
    expect(ranked.every((o) => o.durationScore === 1)).toBe(true);
  });

  it('handles a single offer', () => {
    const ranked = rankOffers([makeOffer({ offerId: 'only', totalAmount: 250 })]);
    expect(ranked).toHaveLength(1);
    expect(ranked[0]!.priceScore).toBe(1);
    expect(ranked[0]!.durationScore).toBe(1);
  });

  it('returns an empty array for no offers', () => {
    expect(rankOffers([])).toEqual([]);
  });

  it('is deterministic and sorts by overall score descending', () => {
    const offers = [
      makeOffer({ offerId: 'a', totalAmount: 300, durationMinutes: 800, maxStops: 2 }),
      makeOffer({ offerId: 'b', totalAmount: 150, durationMinutes: 400, maxStops: 0 }),
      makeOffer({ offerId: 'c', totalAmount: 220, durationMinutes: 600, maxStops: 1 }),
    ];
    const first = rankOffers(offers);
    const second = rankOffers(offers);
    expect(first.map((o) => o.offerId)).toEqual(second.map((o) => o.offerId));
    expect(first[0]!.offerId).toBe('b');
  });
});
