/**
 * Explicit, deterministic state-transition validation for trips and booking
 * attempts. Illegal transitions throw. No AI controls these transitions.
 */
import type { BookingStatus, TripStatus } from '@/types/domain';

const TRIP_TRANSITIONS: Record<TripStatus, TripStatus[]> = {
  DRAFT: ['SEARCHING'],
  SEARCHING: ['PROPOSAL_READY', 'FAILED'],
  PROPOSAL_READY: ['REVALIDATING'],
  REVALIDATING: ['APPROVED', 'PRICE_CHANGED', 'EXPIRED', 'FAILED'],
  APPROVED: ['BOOKING'],
  BOOKING: ['CONFIRMED', 'PENDING_SUPPLIER', 'PRICE_CHANGED', 'EXPIRED', 'FAILED'],
  CONFIRMED: [],
  PENDING_SUPPLIER: ['CONFIRMED', 'FAILED'],
  // After a new explicit approval, a price-changed trip re-enters revalidation.
  PRICE_CHANGED: ['REVALIDATING'],
  EXPIRED: [],
  FAILED: [],
};

const BOOKING_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  CREATED: ['REVALIDATING'],
  REVALIDATING: ['BOOKING', 'PRICE_CHANGED', 'EXPIRED', 'FAILED'],
  BOOKING: ['CONFIRMED', 'PENDING_SUPPLIER', 'FAILED'],
  CONFIRMED: [],
  PENDING_SUPPLIER: ['CONFIRMED', 'FAILED'],
  PRICE_CHANGED: [],
  EXPIRED: [],
  FAILED: [],
};

export class IllegalTransitionError extends Error {
  constructor(
    readonly from: string,
    readonly to: string,
    kind: 'trip' | 'booking',
  ) {
    super(`Illegal ${kind} transition: ${from} → ${to}.`);
    this.name = 'IllegalTransitionError';
  }
}

export function canTransitionTrip(from: TripStatus, to: TripStatus): boolean {
  return TRIP_TRANSITIONS[from].includes(to);
}

export function assertTripTransition(from: TripStatus, to: TripStatus): void {
  if (!canTransitionTrip(from, to)) {
    throw new IllegalTransitionError(from, to, 'trip');
  }
}

export function canTransitionBooking(from: BookingStatus, to: BookingStatus): boolean {
  return BOOKING_TRANSITIONS[from].includes(to);
}

export function assertBookingTransition(from: BookingStatus, to: BookingStatus): void {
  if (!canTransitionBooking(from, to)) {
    throw new IllegalTransitionError(from, to, 'booking');
  }
}

export function isTerminalTrip(status: TripStatus): boolean {
  return TRIP_TRANSITIONS[status].length === 0;
}

export function isTerminalBooking(status: BookingStatus): boolean {
  return BOOKING_TRANSITIONS[status].length === 0;
}
