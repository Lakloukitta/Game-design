import { describe, expect, it } from 'vitest';
import { rankOffers } from '@/lib/flights/rank';
import { selectProposals } from '@/lib/flights/proposals';
import { makeOffer } from '../helpers/offers';

function labels(offers: ReturnType<typeof makeOffer>[]) {
  return selectProposals(rankOffers(offers)).map((p) => p.label);
}

describe('selectProposals', () => {
  it('selects three naturally distinct proposals', () => {
    const proposals = selectProposals(
      rankOffers([
        makeOffer({ offerId: 'best', totalAmount: 250, durationMinutes: 500, maxStops: 1 }),
        makeOffer({ offerId: 'cheap', totalAmount: 150, durationMinutes: 900, maxStops: 2 }),
        makeOffer({ offerId: 'fast', totalAmount: 400, durationMinutes: 300, maxStops: 0 }),
      ]),
    );
    expect(proposals).toHaveLength(3);
    const ids = new Set(proposals.map((p) => p.offerId));
    expect(ids.size).toBe(3);
    expect(proposals.map((p) => p.label)).toContain('Best overall');
    expect(proposals.map((p) => p.label)).toContain('Lowest price');
    expect(proposals.map((p) => p.label)).toContain('Shortest journey');
  });

  it('substitutes a strong alternative when cheapest equals best overall', () => {
    // One dominant cheap+nonstop offer wins both "best overall" and "lowest price".
    const result = labels([
      makeOffer({ offerId: 'dominant', totalAmount: 100, durationMinutes: 300, maxStops: 0 }),
      makeOffer({ offerId: 'mid', totalAmount: 260, durationMinutes: 700, maxStops: 1 }),
      makeOffer({ offerId: 'slow', totalAmount: 280, durationMinutes: 900, maxStops: 2 }),
    ]);
    expect(result[0]).toBe('Best overall');
    expect(result).toContain('Strong alternative');
  });

  it('never emits duplicate proposal offer ids', () => {
    const proposals = selectProposals(
      rankOffers([
        makeOffer({ offerId: 'a', totalAmount: 100, durationMinutes: 300, maxStops: 0 }),
        makeOffer({ offerId: 'b', totalAmount: 500, durationMinutes: 800, maxStops: 2 }),
      ]),
    );
    const ids = proposals.map((p) => p.offerId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('returns fewer than three when fewer offers exist', () => {
    const proposals = selectProposals(rankOffers([makeOffer({ offerId: 'only' })]));
    expect(proposals).toHaveLength(1);
    expect(proposals[0]!.label).toBe('Best overall');
  });

  it('builds a deterministic explanation for the lowest price', () => {
    const proposals = selectProposals(
      rankOffers([
        makeOffer({ offerId: 'best', totalAmount: 250, durationMinutes: 500, maxStops: 1 }),
        makeOffer({ offerId: 'cheap', totalAmount: 150, durationMinutes: 900, maxStops: 2 }),
        makeOffer({ offerId: 'fast', totalAmount: 400, durationMinutes: 300, maxStops: 0 }),
      ]),
    );
    const cheap = proposals.find((p) => p.label === 'Lowest price');
    expect(cheap?.explanation).toMatch(/Lowest available total price/i);
  });
});
