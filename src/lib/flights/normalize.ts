/**
 * Maps a raw supplier offer into the internal NormalizedOffer shape. Malformed
 * offers are rejected (returned as errors) rather than being assigned invented
 * values. Currency filtering against a dominant currency is handled separately
 * by `normalizeOffers`.
 */
import type { NormalizedOffer } from '@/types/domain';
import type { SupplierOffer } from '@/lib/duffel/types';
import { supplierOfferSchema } from '@/lib/duffel/schemas';
import { minutesBetween, tryParseIso8601DurationToMinutes } from './duration';
import { parseAmount } from '@/lib/formatting/currency';

export class OfferNormalizationError extends Error {
  constructor(
    message: string,
    readonly offerId?: string,
  ) {
    super(message);
    this.name = 'OfferNormalizationError';
  }
}

/** Deduplicates while preserving first-seen order; drops empty values. */
function dedupe(values: (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const name = v?.trim();
    if (name && !seen.has(name)) {
      seen.add(name);
      out.push(name);
    }
  }
  return out;
}

/** Duration of one slice: prefer supplier value, else sum segment timestamps. */
function sliceDurationMinutes(slice: SupplierOffer['slices'][number]): number {
  const fromSupplier = tryParseIso8601DurationToMinutes(slice.duration);
  if (fromSupplier !== null && fromSupplier > 0) return fromSupplier;

  // Fallback: first segment departure → last segment arrival.
  const first = slice.segments[0]!;
  const last = slice.segments[slice.segments.length - 1]!;
  const computed = minutesBetween(first.departing_at, last.arriving_at);
  if (computed <= 0) {
    throw new OfferNormalizationError('Could not determine a positive slice duration.');
  }
  return computed;
}

export function normalizeOffer(rawInput: unknown): NormalizedOffer {
  const parsed = supplierOfferSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new OfferNormalizationError(
      `Offer failed schema validation: ${parsed.error.issues[0]?.message ?? 'unknown'}.`,
    );
  }
  const offer = parsed.data as SupplierOffer;

  const totalAmount = parseAmount(offer.total_amount);
  if (totalAmount <= 0) {
    throw new OfferNormalizationError('Offer has a non-positive total amount.', offer.id);
  }

  // Round-trip duration is the sum of slice durations.
  let durationMinutes = 0;
  let maxStops = 0;
  const marketing: (string | null | undefined)[] = [];
  const operating: (string | null | undefined)[] = [];

  for (const slice of offer.slices) {
    durationMinutes += sliceDurationMinutes(slice);
    maxStops = Math.max(maxStops, slice.segments.length - 1);
    for (const seg of slice.segments) {
      marketing.push(seg.marketing_carrier?.name);
      operating.push(seg.operating_carrier?.name);
    }
  }

  if (durationMinutes <= 0) {
    throw new OfferNormalizationError('Offer has a non-positive total duration.', offer.id);
  }

  const firstSlice = offer.slices[0]!;
  const lastSlice = offer.slices[offer.slices.length - 1]!;
  const departureAt = firstSlice.segments[0]!.departing_at;
  const finalArrivalAt = lastSlice.segments[lastSlice.segments.length - 1]!.arriving_at;

  const marketingCarriers = dedupe(marketing);
  const operatingCarriers = dedupe(operating);
  // Prefer the offer owner for the headline airline; else first marketing carrier.
  const airlineName = offer.owner?.name?.trim() || marketingCarriers[0] || 'Unknown airline';

  return {
    offerId: offer.id,
    airlineName,
    marketingCarriers,
    operatingCarriers: operatingCarriers.length > 0 ? operatingCarriers : marketingCarriers,
    totalAmount,
    amountText: offer.total_amount,
    currency: offer.total_currency.toUpperCase(),
    durationMinutes,
    maxStops,
    departureAt,
    finalArrivalAt,
    expiresAt: offer.expires_at,
    passengerIdentityDocumentsRequired: Boolean(offer.passenger_identity_documents_required),
    score: 0,
    raw: rawInput,
  };
}

export interface NormalizeResult {
  offers: NormalizedOffer[];
  currency: string | null;
  rejected: { offerId?: string; reason: string }[];
  /** Offers excluded purely because their currency differed from the dominant one. */
  currencyMismatchCount: number;
}

/**
 * Normalizes a batch, then selects the dominant currency (the one held by the
 * most offers) and excludes mismatched-currency offers — we never compare
 * across currencies without conversion in this MVP.
 */
export function normalizeOffers(rawOffers: unknown[]): NormalizeResult {
  const normalized: NormalizedOffer[] = [];
  const rejected: { offerId?: string; reason: string }[] = [];

  for (const raw of rawOffers) {
    try {
      normalized.push(normalizeOffer(raw));
    } catch (error) {
      if (error instanceof OfferNormalizationError) {
        rejected.push({ offerId: error.offerId, reason: error.message });
      } else {
        rejected.push({ reason: error instanceof Error ? error.message : 'Unknown error.' });
      }
    }
  }

  if (normalized.length === 0) {
    return { offers: [], currency: null, rejected, currencyMismatchCount: 0 };
  }

  // Choose the dominant currency.
  const counts = new Map<string, number>();
  for (const o of normalized) counts.set(o.currency, (counts.get(o.currency) ?? 0) + 1);
  let dominant = normalized[0]!.currency;
  let best = 0;
  for (const [currency, count] of counts) {
    if (count > best) {
      best = count;
      dominant = currency;
    }
  }

  const kept = normalized.filter((o) => o.currency === dominant);
  const currencyMismatchCount = normalized.length - kept.length;

  return { offers: kept, currency: dominant, rejected, currencyMismatchCount };
}
