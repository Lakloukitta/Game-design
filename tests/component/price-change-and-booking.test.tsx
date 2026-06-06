import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PriceChangePanel } from '@/components/price-change-panel';
import { PassengerForm } from '@/components/passenger-form';
import { BookingStatus } from '@/components/booking-status';
import type { BookingStatusResponse } from '@/types/api';

describe('PriceChangePanel', () => {
  it('shows previous and current totals and requires explicit approval', () => {
    const onApprove = vi.fn();
    render(
      <PriceChangePanel
        previousAmount="430.00"
        currentAmount="478.50"
        currency="GBP"
        busy={false}
        onApprove={onApprove}
        onSearchAgain={vi.fn()}
      />,
    );
    expect(screen.getByText(/No reservation was made/i)).toBeInTheDocument();
    expect(screen.getByText(/£430\.00/)).toBeInTheDocument();
    expect(screen.getByText(/£478\.50/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /approve new price/i }));
    expect(onApprove).toHaveBeenCalledTimes(1);
  });
});

describe('PassengerForm double-submit prevention', () => {
  it('disables the submit button while a booking is in progress', () => {
    render(<PassengerForm departureDate="2032-05-01" busy onSubmit={vi.fn()} />);
    expect(
      screen.getByRole('button', { name: /creating your sandbox reservation/i }),
    ).toBeDisabled();
  });

  it('does not collect card or passport fields', () => {
    render(<PassengerForm departureDate="2032-05-01" busy={false} onSubmit={vi.fn()} />);
    expect(screen.queryByLabelText(/card/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/passport/i)).not.toBeInTheDocument();
  });
});

describe('BookingStatus rendering', () => {
  const base: BookingStatusResponse = {
    bookingAttemptId: 'b1',
    tripRequestId: 't1',
    status: 'CONFIRMED',
    acceptedAmount: '462.30',
    confirmedAmount: '462.30',
    currency: 'GBP',
    supplierOrderId: 'ord_1',
    bookingReference: 'ABC123',
    error: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('renders a confirmed reservation with its reference', () => {
    render(
      <BookingStatus booking={base} busy={false} onRefresh={vi.fn()} onSearchAgain={vi.fn()} />,
    );
    expect(screen.getByText(/Sandbox reservation confirmed/i)).toBeInTheDocument();
    expect(screen.getByText('ABC123')).toBeInTheDocument();
  });

  it('renders a pending reservation with a refresh action', () => {
    const onRefresh = vi.fn();
    render(
      <BookingStatus
        booking={{ ...base, status: 'PENDING_SUPPLIER', bookingReference: null }}
        busy={false}
        onRefresh={onRefresh}
        onSearchAgain={vi.fn()}
      />,
    );
    expect(screen.getByText(/still processing/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /refresh status/i }));
    expect(onRefresh).toHaveBeenCalled();
  });

  it('renders a failure with an idempotency-safe message', () => {
    render(
      <BookingStatus
        booking={{ ...base, status: 'FAILED', error: { code: 'X', message: 'Nope.' } }}
        busy={false}
        onRefresh={vi.fn()}
        onSearchAgain={vi.fn()}
      />,
    );
    expect(screen.getByText(/could not complete this sandbox reservation/i)).toBeInTheDocument();
    expect(screen.getByText(/second booking was not created/i)).toBeInTheDocument();
  });
});
