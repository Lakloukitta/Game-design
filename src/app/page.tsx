'use client';

import { useTripFlow } from '@/components/use-trip-flow';
import { TestModeBanner } from '@/components/test-mode-banner';
import { SearchProgress } from '@/components/search-progress';
import { TripSearchForm } from '@/components/trip-search-form';
import { ProposalList } from '@/components/proposal-list';
import { PriceChangePanel } from '@/components/price-change-panel';
import { PassengerForm } from '@/components/passenger-form';
import { BookingStatus } from '@/components/booking-status';
import { Card } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';

export default function HomePage() {
  const { state, search, selectProposal, approveNewPrice, submitBooking, refreshBooking, reset } =
    useTripFlow();

  const searchBusy = state.phase === 'SEARCHING';
  const revalidating = state.phase === 'REVALIDATING';
  const bookingBusy = state.phase === 'BOOKING';
  const showForm =
    state.phase === 'IDLE' ||
    state.phase === 'SEARCHING' ||
    (state.phase === 'FAILED' && state.proposals.length === 0);
  const showProposals =
    state.proposals.length > 0 &&
    (state.phase === 'PROPOSALS_READY' || state.phase === 'REVALIDATING');

  const departureDate = state.selected?.departureAt?.slice(0, 10) ?? '';

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      {/* Header */}
      <header className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">
              Trip Autopilot
            </p>
            <h1 className="mt-1 text-2xl font-bold text-ink sm:text-3xl">
              Find the flight that actually fits your trip.
            </h1>
            <p className="mt-1 text-sm text-ink-muted">
              One trip. One approval. Zero planning stress.
            </p>
          </div>
        </div>
        <p className="max-w-2xl text-sm text-ink-muted">
          Compare live test fares by total price, journey time, and connections—then revalidate and
          create a safe sandbox reservation.
        </p>
        <TestModeBanner />
        <p className="text-xs text-ink-muted">Test inventory only. No real booking or payment.</p>
      </header>

      <div className="my-8">
        <SearchProgress phase={state.phase} />
      </div>

      {state.recovering && (
        <div className="mb-6">
          <Spinner label="Restoring your previous session…" />
        </div>
      )}

      <div className="space-y-6">
        {showForm && <TripSearchForm onSubmit={search} busy={searchBusy} />}

        {state.phase === 'FAILED' && state.proposals.length === 0 && state.error && (
          <Alert tone="error" title="We could not complete that request.">
            {state.error.message}
          </Alert>
        )}

        {searchBusy && (
          <p aria-live="polite" className="text-sm text-ink-muted">
            <Spinner label="Searching live airline test inventory…" />
          </p>
        )}

        {showProposals && (
          <>
            {revalidating && (
              <Alert tone="info" title="Confirming that this fare is still available…">
                <Spinner label="Revalidating with the airline test system…" />
              </Alert>
            )}
            <ProposalList
              proposals={state.proposals}
              offerCount={state.offerCount}
              currency={state.currency}
              selectedOfferId={state.selected?.offerId ?? null}
              busy={revalidating}
              onSelect={selectProposal}
            />
          </>
        )}

        {state.phase === 'PRICE_CHANGED' && state.priceChange && (
          <PriceChangePanel
            previousAmount={state.priceChange.previousAmount}
            currentAmount={state.priceChange.currentAmount}
            currency={state.priceChange.currency}
            busy={false}
            onApprove={() => approveNewPrice()}
            onSearchAgain={reset}
          />
        )}

        {(state.phase === 'PASSENGER_DETAILS' || bookingBusy) && state.selected && (
          <PassengerForm
            departureDate={departureDate}
            busy={bookingBusy}
            onSubmit={submitBooking}
          />
        )}

        {state.phase === 'EXPIRED' && (
          <Card className="space-y-4">
            <Alert tone="warning" title="This offer is no longer available.">
              Run a new search to see current options. No reservation was made.
            </Alert>
            <button
              onClick={reset}
              className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Search again
            </button>
          </Card>
        )}

        {(state.phase === 'CONFIRMED' ||
          state.phase === 'PENDING_SUPPLIER' ||
          (state.phase === 'FAILED' && state.booking)) &&
          state.booking && (
            <BookingStatus
              booking={state.booking}
              busy={false}
              onRefresh={refreshBooking}
              onSearchAgain={reset}
            />
          )}

        {state.phase === 'FAILED' &&
          !state.booking &&
          state.proposals.length > 0 &&
          state.error && (
            <Alert tone="error" title="We could not complete this sandbox reservation.">
              {state.error.message}
            </Alert>
          )}
      </div>

      <footer className="mt-14 border-t border-slate-200 pt-6 text-center text-xs text-ink-muted">
        Trip Autopilot — flight-booking vertical slice on Duffel sandbox. No real payments, no real
        travel. Built for demonstration.
      </footer>
    </main>
  );
}
