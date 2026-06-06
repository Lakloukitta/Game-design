'use client';

import { Card } from './ui/card';
import { Button } from './ui/button';
import { Alert } from './ui/alert';
import type { BookingStatusResponse } from '@/types/api';
import { formatCurrency } from '@/lib/formatting/currency';

export function BookingStatus({
  booking,
  busy,
  onRefresh,
  onSearchAgain,
}: {
  booking: BookingStatusResponse;
  busy: boolean;
  onRefresh: () => void;
  onSearchAgain: () => void;
}) {
  const amount = booking.confirmedAmount ?? booking.acceptedAmount;
  const currency = booking.currency ?? '';

  return (
    <Card className="space-y-4" aria-live="polite">
      {booking.status === 'CONFIRMED' && (
        <>
          <Alert tone="success" title="Sandbox reservation confirmed">
            This is a developer test booking only — no real travel or payment occurred.
          </Alert>
          <DetailRows
            rows={[
              ['Booking reference', booking.bookingReference ?? '—'],
              ['Supplier order ID', booking.supplierOrderId ?? '—'],
              ['Final total', amount ? formatCurrency(Number(amount), currency) : '—'],
            ]}
          />
        </>
      )}

      {booking.status === 'PENDING_SUPPLIER' && (
        <>
          <Alert
            tone="warning"
            title="The airline accepted the request, but full confirmation is still processing."
          >
            This reservation is not fully confirmed yet. You can refresh its status.
          </Alert>
          <DetailRows
            rows={[
              ['Supplier order ID', booking.supplierOrderId ?? '—'],
              ['Quoted total', amount ? formatCurrency(Number(amount), currency) : '—'],
            ]}
          />
          <Button variant="secondary" onClick={onRefresh} loading={busy}>
            Refresh status
          </Button>
        </>
      )}

      {booking.status === 'FAILED' && (
        <>
          <Alert tone="error" title="We could not complete this sandbox reservation.">
            {booking.error?.message ?? 'The supplier rejected the booking.'} A second booking was
            not created — your retry was protected by idempotency.
          </Alert>
          <Button variant="secondary" onClick={onSearchAgain}>
            Search again
          </Button>
        </>
      )}

      <p className="text-[11px] text-ink-muted">
        Attempt {booking.bookingAttemptId} · updated {new Date(booking.updatedAt).toLocaleString()}
      </p>
    </Card>
  );
}

function DetailRows({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="divide-y divide-slate-100 rounded-lg border border-slate-200">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
          <dt className="text-ink-muted">{label}</dt>
          <dd className="font-medium text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
