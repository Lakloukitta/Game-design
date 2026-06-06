'use client';

import { Card } from './ui/card';
import { Button } from './ui/button';
import { Alert } from './ui/alert';
import { formatCurrency } from '@/lib/formatting/currency';

export function PriceChangePanel({
  previousAmount,
  currentAmount,
  currency,
  busy,
  onApprove,
  onSearchAgain,
}: {
  previousAmount: string;
  currentAmount: string;
  currency: string;
  busy: boolean;
  onApprove: () => void;
  onSearchAgain: () => void;
}) {
  const prev = Number(previousAmount);
  const curr = Number(currentAmount);
  const increased = curr > prev;

  return (
    <Card className="space-y-4" aria-live="polite">
      <Alert tone="warning" title="The fare changed before booking. No reservation was made.">
        Please review and explicitly approve the new price before we continue.
      </Alert>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-[11px] uppercase tracking-wide text-ink-muted">Previously shown</p>
          <p className="text-lg font-semibold text-ink line-through">
            {formatCurrency(prev, currency)}
          </p>
        </div>
        <div className="rounded-lg bg-brand-50 p-3">
          <p className="text-[11px] uppercase tracking-wide text-ink-muted">New price</p>
          <p className="text-lg font-bold text-brand-800">{formatCurrency(curr, currency)}</p>
          <p className="text-xs text-ink-muted">{increased ? 'Higher' : 'Lower'} than before</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button onClick={onApprove} loading={busy}>
          Approve new price
        </Button>
        <Button variant="secondary" onClick={onSearchAgain} disabled={busy}>
          Search again
        </Button>
      </div>
    </Card>
  );
}
