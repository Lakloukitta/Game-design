'use client';

import { Card } from './ui/card';
import { Button } from './ui/button';
import type { Proposal } from '@/types/api';
import { formatCurrency } from '@/lib/formatting/currency';
import { formatDurationMinutes, formatStops } from '@/lib/formatting/duration';
import { formatDateTime } from '@/lib/formatting/date-time';
import { minutesUntil } from '@/lib/formatting/date-time';

export function ProposalCard({
  proposal,
  highlighted,
  busy,
  onSelect,
}: {
  proposal: Proposal;
  highlighted: boolean;
  busy: boolean;
  onSelect: (proposal: Proposal) => void;
}) {
  const expiresInMin = minutesUntil(proposal.expiresAt);
  const operatedBy = proposal.operatingCarriers.join(', ');
  const marketedBy = proposal.marketingCarriers.join(', ');
  const showMarketing = marketedBy && marketedBy !== operatedBy;

  return (
    <Card highlighted={highlighted} className="flex h-full flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <span className="inline-flex items-center rounded-full bg-brand-100 px-2.5 py-1 text-xs font-semibold text-brand-800">
          {proposal.label}
        </span>
        <div className="text-right">
          <p className="text-2xl font-bold text-ink">
            {formatCurrency(proposal.totalAmount, proposal.currency)}
          </p>
          <p className="text-[11px] text-ink-muted">round trip · {proposal.currency}</p>
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <p className="font-semibold text-ink">{proposal.airlineName}</p>
        <p className="text-ink-muted">
          <span className="font-medium text-ink-soft">Operated by:</span> {operatedBy || '—'}
        </p>
        {showMarketing && <p className="text-xs text-ink-muted">Marketed by {marketedBy}</p>}
      </div>

      <dl className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 text-sm">
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-ink-muted">Depart</dt>
          <dd className="font-medium text-ink">{formatDateTime(proposal.departureAt)}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-ink-muted">Return arrives</dt>
          <dd className="font-medium text-ink">{formatDateTime(proposal.finalArrivalAt)}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-ink-muted">Total journey</dt>
          <dd className="font-medium text-ink">
            {formatDurationMinutes(proposal.durationMinutes)}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-ink-muted">Stops</dt>
          <dd className="font-medium text-ink">{formatStops(proposal.maxStops)}</dd>
        </div>
      </dl>

      <p className="text-sm text-ink-muted">{proposal.explanation}</p>

      <div className="mt-auto flex items-center justify-between gap-2 text-xs text-ink-muted">
        <span title="Fit score combines price, journey time, and connections. Not a customer review.">
          Fit score {proposal.score.toFixed(2)} / 1.00
        </span>
        <span>
          {expiresInMin > 0 ? `Offer valid ~${expiresInMin} min` : 'Offer may have expired'}
        </span>
      </div>

      <Button onClick={() => onSelect(proposal)} loading={busy} className="w-full">
        Select this flight
      </Button>
    </Card>
  );
}
