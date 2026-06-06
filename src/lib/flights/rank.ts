/**
 * Deterministic, LLM-free ranking. Operates only on offers in a single
 * currency (the caller filters mismatched currencies first).
 *
 *   priceScore    = inverse normalized total price
 *   durationScore = inverse normalized total journey duration
 *   stopScore     = 1.00 nonstop / 0.55 one stop / 0.10 two+ stops
 *   overallScore  = 0.50*price + 0.30*duration + 0.20*stops
 *
 * Equal min/max values are handled without division by zero (all tie at 1.0).
 */
import type { NormalizedOffer } from '@/types/domain';

export const WEIGHTS = { price: 0.5, duration: 0.3, stops: 0.2 } as const;

export function stopScore(maxStops: number): number {
  if (maxStops <= 0) return 1.0;
  if (maxStops === 1) return 0.55;
  return 0.1;
}

/**
 * Inverse-normalizes a value within [min, max] so that the minimum maps to 1.0
 * and the maximum maps to 0.0. When min === max every value scores 1.0.
 */
export function inverseNormalize(value: number, min: number, max: number): number {
  if (max === min) return 1.0;
  return (max - value) / (max - min);
}

export interface ScoredOffer extends NormalizedOffer {
  priceScore: number;
  durationScore: number;
  stopScore: number;
  overallScore: number;
}

/**
 * Returns offers augmented with score components, sorted by overallScore
 * descending. Ties are broken deterministically by price, then duration, then
 * offerId so ordering is stable across runs.
 */
export function rankOffers(offers: NormalizedOffer[]): ScoredOffer[] {
  if (offers.length === 0) return [];

  const prices = offers.map((o) => o.totalAmount);
  const durations = offers.map((o) => o.durationMinutes);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const minDuration = Math.min(...durations);
  const maxDuration = Math.max(...durations);

  const scored = offers.map<ScoredOffer>((offer) => {
    const priceScore = inverseNormalize(offer.totalAmount, minPrice, maxPrice);
    const durationScore = inverseNormalize(offer.durationMinutes, minDuration, maxDuration);
    const sScore = stopScore(offer.maxStops);
    const overallScore =
      WEIGHTS.price * priceScore + WEIGHTS.duration * durationScore + WEIGHTS.stops * sScore;
    return {
      ...offer,
      priceScore,
      durationScore,
      stopScore: sScore,
      // Persist the rounded overall score on the offer for storage/display.
      score: round2(overallScore),
      overallScore,
    };
  });

  scored.sort(
    (a, b) =>
      b.overallScore - a.overallScore ||
      a.totalAmount - b.totalAmount ||
      a.durationMinutes - b.durationMinutes ||
      a.offerId.localeCompare(b.offerId),
  );

  return scored;
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
