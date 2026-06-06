/**
 * Deterministic selection of up to three distinct proposals from ranked offers:
 *   1. Best overall      — highest overallScore
 *   2. Lowest price       — lowest total amount
 *   3. Shortest journey   — lowest duration
 *
 * If a label collides with one already chosen, the next-best distinct offer is
 * substituted and labelled "Strong alternative". Offers are never fabricated.
 */
import type { Proposal, ProposalLabel } from '@/types/domain';
import type { ScoredOffer } from './rank';
import { formatCurrency } from '@/lib/formatting/currency';
import { formatDurationMinutes, formatStops } from '@/lib/formatting/duration';

interface Candidate {
  offer: ScoredOffer;
  baseLabel: ProposalLabel;
}

export function selectProposals(scored: ScoredOffer[]): Proposal[] {
  if (scored.length === 0) return [];

  const byOverall = [...scored].sort((a, b) => b.overallScore - a.overallScore);
  const byPrice = [...scored].sort(
    (a, b) => a.totalAmount - b.totalAmount || a.offerId.localeCompare(b.offerId),
  );
  const byDuration = [...scored].sort(
    (a, b) => a.durationMinutes - b.durationMinutes || a.offerId.localeCompare(b.offerId),
  );

  const candidates: Candidate[] = [
    { offer: byOverall[0]!, baseLabel: 'Best overall' },
    { offer: byPrice[0]!, baseLabel: 'Lowest price' },
    { offer: byDuration[0]!, baseLabel: 'Shortest journey' },
  ];

  const chosen: { offer: ScoredOffer; label: ProposalLabel }[] = [];
  const usedOfferIds = new Set<string>();

  for (const candidate of candidates) {
    if (!usedOfferIds.has(candidate.offer.offerId)) {
      chosen.push({ offer: candidate.offer, label: candidate.baseLabel });
      usedOfferIds.add(candidate.offer.offerId);
      continue;
    }
    // Collision: find the best distinct alternative by overall score.
    const alt = byOverall.find((o) => !usedOfferIds.has(o.offerId));
    if (alt) {
      chosen.push({ offer: alt, label: 'Strong alternative' });
      usedOfferIds.add(alt.offerId);
    }
    // If no distinct alternative exists, we simply return fewer proposals.
  }

  const cheapestAmount = byPrice[0]!.totalAmount;
  const shortestDuration = byDuration[0]!.durationMinutes;

  return chosen.map(({ offer, label }) =>
    toProposal(offer, label, { cheapestAmount, shortestDuration }),
  );
}

function toProposal(
  offer: ScoredOffer,
  label: ProposalLabel,
  context: { cheapestAmount: number; shortestDuration: number },
): Proposal {
  return {
    label,
    offerId: offer.offerId,
    airlineName: offer.airlineName,
    marketingCarriers: offer.marketingCarriers,
    operatingCarriers: offer.operatingCarriers,
    totalAmount: offer.totalAmount,
    amountText: offer.amountText,
    currency: offer.currency,
    durationMinutes: offer.durationMinutes,
    maxStops: offer.maxStops,
    departureAt: offer.departureAt,
    finalArrivalAt: offer.finalArrivalAt,
    expiresAt: offer.expiresAt,
    score: offer.score,
    explanation: buildExplanation(offer, label, context),
  };
}

/**
 * Builds a deterministic explanation sentence from structured values only.
 * No LLM, no invented facts.
 */
export function buildExplanation(
  offer: ScoredOffer,
  label: ProposalLabel,
  context: { cheapestAmount: number; shortestDuration: number },
): string {
  const stops = formatStops(offer.maxStops).toLowerCase();
  const duration = formatDurationMinutes(offer.durationMinutes);

  switch (label) {
    case 'Lowest price':
      return `Lowest available total price among the returned test offers (${duration} total, ${stops}).`;
    case 'Shortest journey':
      return `Shortest total journey at ${duration}, ${stops}.`;
    case 'Best overall': {
      const extraCost = Math.round((offer.totalAmount - context.cheapestAmount) * 100) / 100;
      const savedMinutes = offer.durationMinutes - context.shortestDuration;
      if (extraCost <= 0 && savedMinutes <= 0) {
        return `Best balance of price, journey time, and connections (${duration}, ${stops}).`;
      }
      const parts: string[] = [];
      if (extraCost > 0) {
        parts.push(
          `costs ${formatCurrency(extraCost, offer.currency)} more than the cheapest option`,
        );
      }
      if (savedMinutes < 0) {
        parts.push(`saves ${formatDurationMinutes(Math.abs(savedMinutes))} versus the cheapest`);
      }
      parts.push(`${duration} total, ${stops}`);
      return `Best overall balance — ${parts.join(', ')}.`;
    }
    case 'Strong alternative':
      return `A strong distinct alternative: ${duration} total, ${stops}.`;
    default:
      return `${duration} total, ${stops}.`;
  }
}
