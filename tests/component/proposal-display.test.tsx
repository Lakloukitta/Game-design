import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProposalList } from '@/components/proposal-list';
import { ProposalCard } from '@/components/proposal-card';
import type { Proposal } from '@/types/api';

const proposal: Proposal = {
  label: 'Best overall',
  offerId: 'off_1',
  airlineName: 'Duffel Airways',
  marketingCarriers: ['Duffel Airways'],
  operatingCarriers: ['Duffel Regional'],
  totalAmount: 462.3,
  amountText: '462.30',
  currency: 'GBP',
  durationMinutes: 980,
  maxStops: 1,
  departureAt: '2032-05-01T08:00:00Z',
  finalArrivalAt: '2032-05-08T18:00:00Z',
  expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
  score: 0.82,
  explanation: 'Best overall balance — 16h 20m total, 1 stop.',
};

describe('proposal display', () => {
  it('renders the label, price, and prominent operating carrier', () => {
    render(
      <ProposalList
        proposals={[proposal]}
        offerCount={9}
        currency="GBP"
        selectedOfferId={null}
        busy={false}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText('Best overall')).toBeInTheDocument();
    expect(screen.getByText(/£462\.30/)).toBeInTheDocument();
    expect(screen.getByText(/Operated by:/i)).toBeInTheDocument();
    expect(screen.getByText(/Duffel Regional/)).toBeInTheDocument();
    expect(screen.getByText(/Fit score 0\.82/)).toBeInTheDocument();
  });

  it('calls onSelect when the select button is clicked', () => {
    const onSelect = vi.fn();
    render(
      <ProposalCard proposal={proposal} highlighted={false} busy={false} onSelect={onSelect} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /select this flight/i }));
    expect(onSelect).toHaveBeenCalledWith(proposal);
  });

  it('disables the select button while busy (prevents double submission)', () => {
    render(<ProposalCard proposal={proposal} highlighted busy onSelect={vi.fn()} />);
    expect(screen.getByRole('button', { name: /select this flight/i })).toBeDisabled();
  });
});
