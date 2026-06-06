import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TripSearchForm } from '@/components/trip-search-form';

describe('TripSearchForm', () => {
  it('shows a validation summary and does not submit when dates are missing', () => {
    const onSubmit = vi.fn();
    render(<TripSearchForm onSubmit={onSubmit} busy={false} />);
    fireEvent.click(screen.getByRole('button', { name: /search live test flights/i }));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits normalized values when the form is valid', () => {
    const onSubmit = vi.fn();
    render(<TripSearchForm onSubmit={onSubmit} busy={false} />);

    fireEvent.change(screen.getByLabelText(/departure date/i), {
      target: { value: '2032-05-01' },
    });
    fireEvent.change(screen.getByLabelText(/return date/i), {
      target: { value: '2032-05-08' },
    });
    fireEvent.click(screen.getByRole('button', { name: /search live test flights/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]![0]).toMatchObject({
      origin: 'LHR',
      destination: 'JFK',
      departureDate: '2032-05-01',
      returnDate: '2032-05-08',
      cabinClass: 'economy',
      maxConnections: 1,
    });
  });

  it('disables the submit button while busy', () => {
    render(<TripSearchForm onSubmit={vi.fn()} busy />);
    expect(
      screen.getByRole('button', { name: /searching live airline test inventory/i }),
    ).toBeDisabled();
  });
});
