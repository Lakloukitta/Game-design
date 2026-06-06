import { describe, expect, it } from 'vitest';
import {
  assertBookingTransition,
  assertTripTransition,
  canTransitionBooking,
  canTransitionTrip,
  IllegalTransitionError,
  isTerminalBooking,
  isTerminalTrip,
} from '@/lib/booking/state-machine';

describe('trip state machine', () => {
  it('allows representative legal transitions', () => {
    expect(canTransitionTrip('DRAFT', 'SEARCHING')).toBe(true);
    expect(canTransitionTrip('SEARCHING', 'PROPOSAL_READY')).toBe(true);
    expect(canTransitionTrip('REVALIDATING', 'PRICE_CHANGED')).toBe(true);
    expect(canTransitionTrip('PRICE_CHANGED', 'REVALIDATING')).toBe(true);
    expect(canTransitionTrip('BOOKING', 'CONFIRMED')).toBe(true);
    expect(canTransitionTrip('PENDING_SUPPLIER', 'CONFIRMED')).toBe(true);
  });

  it('rejects representative illegal transitions', () => {
    expect(canTransitionTrip('CONFIRMED', 'BOOKING')).toBe(false);
    expect(canTransitionTrip('SEARCHING', 'CONFIRMED')).toBe(false);
    expect(canTransitionTrip('APPROVED', 'PRICE_CHANGED')).toBe(false);
    expect(() => assertTripTransition('CONFIRMED', 'SEARCHING')).toThrow(IllegalTransitionError);
  });

  it('marks terminal trip states', () => {
    expect(isTerminalTrip('CONFIRMED')).toBe(true);
    expect(isTerminalTrip('EXPIRED')).toBe(true);
    expect(isTerminalTrip('PROPOSAL_READY')).toBe(false);
  });
});

describe('booking-attempt state machine', () => {
  it('allows representative legal transitions', () => {
    expect(canTransitionBooking('CREATED', 'REVALIDATING')).toBe(true);
    expect(canTransitionBooking('REVALIDATING', 'BOOKING')).toBe(true);
    expect(canTransitionBooking('BOOKING', 'PENDING_SUPPLIER')).toBe(true);
    expect(canTransitionBooking('PENDING_SUPPLIER', 'CONFIRMED')).toBe(true);
  });

  it('rejects representative illegal transitions', () => {
    expect(canTransitionBooking('CREATED', 'CONFIRMED')).toBe(false);
    expect(canTransitionBooking('CONFIRMED', 'FAILED')).toBe(false);
    expect(() => assertBookingTransition('PRICE_CHANGED', 'BOOKING')).toThrow(
      IllegalTransitionError,
    );
  });

  it('marks terminal booking states', () => {
    expect(isTerminalBooking('CONFIRMED')).toBe(true);
    expect(isTerminalBooking('FAILED')).toBe(true);
    expect(isTerminalBooking('CREATED')).toBe(false);
  });
});
