'use client';

import { ProposalCard } from './proposal-card';
import type { Proposal } from '@/types/api';

export function ProposalList({
  proposals,
  offerCount,
  currency,
  selectedOfferId,
  busy,
  onSelect,
}: {
  proposals: Proposal[];
  offerCount: number;
  currency: string | null;
  selectedOfferId: string | null;
  busy: boolean;
  onSelect: (proposal: Proposal) => void;
}) {
  return (
    <section aria-label="Flight proposals" className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-ink">Your three best fits</h2>
        <p className="text-xs text-ink-muted">
          From {offerCount} test offer{offerCount === 1 ? '' : 's'}
          {currency ? ` · ${currency}` : ''}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {proposals.map((proposal) => (
          <ProposalCard
            key={proposal.offerId}
            proposal={proposal}
            highlighted={proposal.offerId === selectedOfferId}
            busy={busy && proposal.offerId === selectedOfferId}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  );
}
