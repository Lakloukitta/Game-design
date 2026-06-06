'use client';

import { useCallback, useEffect, useReducer, useRef } from 'react';
import { api, ApiClientError } from '@/lib/client/api';
import type { BookingStatusResponse, Proposal } from '@/types/api';
import type { PassengerInput, TripSearchInput } from '@/types/domain';

export type UIPhase =
  | 'IDLE'
  | 'VALIDATING'
  | 'SEARCHING'
  | 'PROPOSALS_READY'
  | 'REVALIDATING'
  | 'PRICE_CHANGED'
  | 'PASSENGER_DETAILS'
  | 'BOOKING'
  | 'CONFIRMED'
  | 'PENDING_SUPPLIER'
  | 'EXPIRED'
  | 'FAILED';

interface PriceChange {
  previousAmount: string;
  currentAmount: string;
  currency: string;
}

export interface FlowError {
  code: string;
  message: string;
  fieldErrors?: Record<string, string[]>;
}

export interface FlowState {
  phase: UIPhase;
  recovering: boolean;
  tripRequestId: string | null;
  offerCount: number;
  currency: string | null;
  proposals: Proposal[];
  selected: Proposal | null;
  acceptedAmount: string | null;
  acceptedCurrency: string | null;
  priceChange: PriceChange | null;
  checkoutAttemptId: string | null;
  booking: BookingStatusResponse | null;
  error: FlowError | null;
}

const initialState: FlowState = {
  phase: 'IDLE',
  recovering: false,
  tripRequestId: null,
  offerCount: 0,
  currency: null,
  proposals: [],
  selected: null,
  acceptedAmount: null,
  acceptedCurrency: null,
  priceChange: null,
  checkoutAttemptId: null,
  booking: null,
  error: null,
};

type Action =
  | { type: 'RESET' }
  | { type: 'SEARCH_START' }
  | {
      type: 'SEARCH_OK';
      tripRequestId: string;
      proposals: Proposal[];
      currency: string;
      offerCount: number;
    }
  | { type: 'ERROR'; phase: UIPhase; error: FlowError }
  | { type: 'REVALIDATE_START'; selected: Proposal }
  | {
      type: 'APPROVED';
      acceptedAmount: string;
      acceptedCurrency: string;
      checkoutAttemptId: string;
    }
  | { type: 'PRICE_CHANGED'; priceChange: PriceChange }
  | { type: 'EXPIRED' }
  | { type: 'BOOK_START' }
  | { type: 'BOOKING_RESULT'; booking: BookingStatusResponse }
  | { type: 'RECOVER_START' }
  | { type: 'RECOVER_DONE'; patch: Partial<FlowState> };

function phaseFromBooking(status: BookingStatusResponse['status']): UIPhase {
  switch (status) {
    case 'CONFIRMED':
      return 'CONFIRMED';
    case 'PENDING_SUPPLIER':
      return 'PENDING_SUPPLIER';
    case 'PRICE_CHANGED':
      return 'PRICE_CHANGED';
    case 'EXPIRED':
      return 'EXPIRED';
    case 'FAILED':
      return 'FAILED';
    default:
      return 'BOOKING';
  }
}

function reducer(state: FlowState, action: Action): FlowState {
  switch (action.type) {
    case 'RESET':
      return initialState;
    case 'SEARCH_START':
      return { ...initialState, phase: 'SEARCHING' };
    case 'SEARCH_OK':
      return {
        ...state,
        phase: 'PROPOSALS_READY',
        tripRequestId: action.tripRequestId,
        proposals: action.proposals,
        currency: action.currency,
        offerCount: action.offerCount,
        error: null,
      };
    case 'ERROR':
      return { ...state, phase: action.phase, error: action.error };
    case 'REVALIDATE_START':
      return { ...state, phase: 'REVALIDATING', selected: action.selected, error: null };
    case 'APPROVED':
      return {
        ...state,
        phase: 'PASSENGER_DETAILS',
        acceptedAmount: action.acceptedAmount,
        acceptedCurrency: action.acceptedCurrency,
        checkoutAttemptId: action.checkoutAttemptId,
        priceChange: null,
        error: null,
      };
    case 'PRICE_CHANGED':
      return { ...state, phase: 'PRICE_CHANGED', priceChange: action.priceChange };
    case 'EXPIRED':
      return { ...state, phase: 'EXPIRED' };
    case 'BOOK_START':
      return { ...state, phase: 'BOOKING', error: null };
    case 'BOOKING_RESULT':
      return {
        ...state,
        phase: phaseFromBooking(action.booking.status),
        booking: action.booking,
      };
    case 'RECOVER_START':
      return { ...state, recovering: true };
    case 'RECOVER_DONE':
      return { ...state, recovering: false, ...action.patch };
    default:
      return state;
  }
}

const TRIP_KEY = 'ta.tripRequestId';
const BOOKING_KEY = 'ta.bookingAttemptId';

function toFlowError(error: unknown): FlowError {
  if (error instanceof ApiClientError) {
    return {
      code: error.body.code,
      message: error.body.message,
      fieldErrors: error.body.fieldErrors,
    };
  }
  return { code: 'UNKNOWN', message: 'Something went wrong. Please try again.' };
}

export function useTripFlow() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const recovered = useRef(false);

  // ── Browser-refresh recovery: never auto-resubmits a booking ───────────────
  useEffect(() => {
    if (recovered.current) return;
    recovered.current = true;
    const tripId = sessionStorage.getItem(TRIP_KEY);
    const bookingId = sessionStorage.getItem(BOOKING_KEY);
    if (!tripId) return;

    dispatch({ type: 'RECOVER_START' });
    (async () => {
      const patch: Partial<FlowState> = {};
      try {
        const trip = await api.getTrip(tripId);
        patch.tripRequestId = trip.tripRequestId;
        patch.proposals = trip.proposals;
        patch.currency = trip.currency;
        patch.offerCount = trip.proposals.length;
        if (trip.proposals.length > 0 && trip.status === 'PROPOSAL_READY') {
          patch.phase = 'PROPOSALS_READY';
        }
      } catch {
        sessionStorage.removeItem(TRIP_KEY);
      }
      if (bookingId) {
        try {
          const booking = await api.getBooking(bookingId);
          patch.booking = booking;
          patch.phase = phaseFromBooking(booking.status);
        } catch {
          sessionStorage.removeItem(BOOKING_KEY);
        }
      }
      dispatch({ type: 'RECOVER_DONE', patch });
    })();
  }, []);

  const search = useCallback(async (input: TripSearchInput) => {
    dispatch({ type: 'SEARCH_START' });
    sessionStorage.removeItem(TRIP_KEY);
    sessionStorage.removeItem(BOOKING_KEY);
    try {
      const res = await api.search(input);
      sessionStorage.setItem(TRIP_KEY, res.tripRequestId);
      dispatch({
        type: 'SEARCH_OK',
        tripRequestId: res.tripRequestId,
        proposals: res.proposals,
        currency: res.currency,
        offerCount: res.offerCount,
      });
    } catch (error) {
      dispatch({ type: 'ERROR', phase: 'FAILED', error: toFlowError(error) });
    }
  }, []);

  // Revalidate a freshly-selected proposal (or re-approve a changed price).
  const revalidate = useCallback(
    async (selected: Proposal, displayedAmount: string, displayedCurrency: string) => {
      if (!state.tripRequestId) return;
      dispatch({ type: 'REVALIDATE_START', selected });
      try {
        const res = await api.revalidate({
          tripRequestId: state.tripRequestId,
          offerId: selected.offerId,
          previouslyDisplayedAmount: displayedAmount,
          previouslyDisplayedCurrency: displayedCurrency,
        });
        if (res.expired || !res.available) {
          dispatch({ type: 'EXPIRED' });
        } else if (res.changed) {
          dispatch({
            type: 'PRICE_CHANGED',
            priceChange: {
              previousAmount: res.previousAmount,
              currentAmount: res.currentAmount,
              currency: res.currency,
            },
          });
        } else {
          dispatch({
            type: 'APPROVED',
            acceptedAmount: res.currentAmount,
            acceptedCurrency: res.currency,
            checkoutAttemptId: crypto.randomUUID(),
          });
        }
      } catch (error) {
        dispatch({ type: 'ERROR', phase: 'FAILED', error: toFlowError(error) });
      }
    },
    [state.tripRequestId],
  );

  const selectProposal = useCallback(
    (proposal: Proposal) => revalidate(proposal, proposal.amountText, proposal.currency),
    [revalidate],
  );

  // User explicitly approves a new price: re-revalidate against the new amount.
  const approveNewPrice = useCallback(() => {
    if (!state.selected || !state.priceChange) return;
    return revalidate(state.selected, state.priceChange.currentAmount, state.priceChange.currency);
  }, [revalidate, state.selected, state.priceChange]);

  const submitBooking = useCallback(
    async (passenger: PassengerInput) => {
      if (
        !state.tripRequestId ||
        !state.selected ||
        !state.checkoutAttemptId ||
        !state.acceptedAmount ||
        !state.acceptedCurrency
      ) {
        return;
      }
      dispatch({ type: 'BOOK_START' });
      try {
        const booking = await api.book({
          tripRequestId: state.tripRequestId,
          offerId: state.selected.offerId,
          checkoutAttemptId: state.checkoutAttemptId, // reused on network retry
          acceptedAmount: state.acceptedAmount,
          acceptedCurrency: state.acceptedCurrency,
          passenger,
        });
        sessionStorage.setItem(BOOKING_KEY, booking.bookingAttemptId);
        dispatch({ type: 'BOOKING_RESULT', booking });
      } catch (error) {
        const flowError = toFlowError(error);
        if (error instanceof ApiClientError) {
          if (error.body.code === 'PRICE_CHANGED' && error.body.details) {
            dispatch({
              type: 'PRICE_CHANGED',
              priceChange: {
                previousAmount: String(error.body.details.previousAmount ?? state.acceptedAmount),
                currentAmount: String(error.body.details.currentAmount ?? ''),
                currency: String(error.body.details.currency ?? state.acceptedCurrency),
              },
            });
            return;
          }
          if (error.body.code === 'OFFER_EXPIRED') {
            dispatch({ type: 'EXPIRED' });
            return;
          }
        }
        dispatch({ type: 'ERROR', phase: 'FAILED', error: flowError });
      }
    },
    [state],
  );

  const refreshBooking = useCallback(async () => {
    if (!state.booking) return;
    try {
      const booking = await api.getBooking(state.booking.bookingAttemptId);
      dispatch({ type: 'BOOKING_RESULT', booking });
    } catch (error) {
      dispatch({ type: 'ERROR', phase: state.phase, error: toFlowError(error) });
    }
  }, [state.booking, state.phase]);

  const reset = useCallback(() => {
    sessionStorage.removeItem(TRIP_KEY);
    sessionStorage.removeItem(BOOKING_KEY);
    dispatch({ type: 'RESET' });
  }, []);

  return {
    state,
    search,
    selectProposal,
    approveNewPrice,
    submitBooking,
    refreshBooking,
    reset,
  };
}
