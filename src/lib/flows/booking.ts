/**
 * Booking orchestration with rigorous application-level idempotency.
 *
 * Order of operations:
 *   1. Resolve trip + offer, verify relationship and allowed state.
 *   2. Atomically create the booking attempt keyed by checkoutAttemptId.
 *      - If it already exists, echo its current state and DO NOT call supplier.
 *   3. Move trip APPROVED → BOOKING and attempt CREATED → REVALIDATING.
 *   4. Re-fetch the offer; detect expiry, documents, price/currency change.
 *   5. Only when the supplier amount still matches the user-approved amount do
 *      we create the order. Otherwise PRICE_CHANGED / EXPIRED / 422 documents.
 *   6. Interpret the supplier order truthfully: CONFIRMED / PENDING_SUPPLIER /
 *      FAILED. Never report CONFIRMED unless the supplier established it.
 *
 * The passenger object is used only to build the supplier request; it is never
 * persisted or logged.
 */
import type { Services } from '@/lib/services';
import type { BookingStatusResponse } from '@/types/api';
import { ApiError } from '@/lib/api/errors';
import { amountsEqual } from '@/lib/formatting/currency';
import { isExpired } from '@/lib/formatting/date-time';
import { normalizeOffer } from '@/lib/flights/normalize';
import { bookingStatusFromOrderResult } from '@/lib/duffel/mapper';
import { bookingAttemptToResponse } from '@/lib/api/presenters';
import type { BookingRequest } from '@/lib/validation/booking';
import type { BookingAttemptRow } from '@/lib/database/types';

export async function runBooking(
  services: Services,
  req: BookingRequest,
  now: number = Date.now(),
): Promise<BookingStatusResponse> {
  const { repo, supplier } = services;

  const trip = await repo.getTripRequest(req.tripRequestId);
  if (!trip) throw new ApiError('NOT_FOUND', 'Trip request not found.', { retryable: false });

  const storedOffer = await repo.getOffer(req.tripRequestId, req.offerId);
  if (!storedOffer) {
    throw new ApiError('NOT_FOUND', 'That offer does not belong to this trip.', {
      retryable: false,
    });
  }

  // ── Idempotency gate (before any supplier call) ───────────────────────────
  const { attempt, created } = await repo.createBookingAttempt({
    tripRequestId: req.tripRequestId,
    supplierOfferId: req.offerId,
    idempotencyKey: req.checkoutAttemptId,
    quotedAmount: req.acceptedAmount,
    currency: req.acceptedCurrency,
  });

  if (!created) {
    // Existing attempt: never call the supplier again; echo current state.
    return bookingAttemptToResponse(attempt);
  }

  // Trip must have been APPROVED by a prior successful revalidation.
  if (trip.status !== 'APPROVED') {
    await repo.updateBookingAttempt(attempt.id, 'REVALIDATING');
    await repo.updateBookingAttempt(attempt.id, 'FAILED', {
      error: { code: 'STATE_CONFLICT', message: `Trip not approved (state ${trip.status}).` },
    });
    throw new ApiError('STATE_CONFLICT', 'This trip is not in an approved state for booking.', {
      retryable: false,
      details: { status: trip.status, bookingAttemptId: attempt.id },
    });
  }

  await repo.updateTripStatus(req.tripRequestId, 'BOOKING');
  await repo.updateBookingAttempt(attempt.id, 'REVALIDATING');
  await repo.insertAuditEvent({
    tripRequestId: req.tripRequestId,
    bookingAttemptId: attempt.id,
    eventType: 'BOOKING_REVALIDATION_STARTED',
    eventData: { offerId: req.offerId },
  });

  // ── Final authoritative revalidation ──────────────────────────────────────
  let currentAmount: string;
  let currentCurrency: string;
  let identityDocumentsRequired: boolean;
  let passengerId: string;
  try {
    const supplierOffer = await supplier.getOffer(req.offerId);
    const normalized = normalizeOffer(supplierOffer);
    currentAmount = normalized.amountText;
    currentCurrency = normalized.currency;
    identityDocumentsRequired = normalized.passengerIdentityDocumentsRequired;
    passengerId = supplierOffer.passengers[0]?.id ?? '';

    if (isExpired(normalized.expiresAt, now)) {
      return await finishExpired(services, req, attempt);
    }
  } catch (error) {
    // `finishExpired` throws a controlled OFFER_EXPIRED ApiError from inside the
    // try; let any already-controlled ApiError propagate unchanged.
    if (error instanceof ApiError) throw error;
    const status = (error as { status?: number }).status;
    if (status === 404) {
      return await finishExpired(services, req, attempt);
    }
    await markFailed(services, req, attempt, 'SUPPLIER_ERROR', 'Revalidation failed at supplier.');
    throw new ApiError('SUPPLIER_ERROR', 'Could not revalidate the offer before booking.', {
      retryable: true,
      internalCause: error,
      details: { bookingAttemptId: attempt.id },
    });
  }

  // Identity documents are out of scope for this MVP — do not collect passports.
  if (identityDocumentsRequired) {
    await repo.updateBookingAttempt(attempt.id, 'FAILED', {
      error: {
        code: 'DOCUMENTS_REQUIRED',
        message: 'This offer requires identity documents, which are not supported in this demo.',
      },
    });
    await repo.updateTripStatus(req.tripRequestId, 'FAILED', {
      error: { code: 'DOCUMENTS_REQUIRED', message: 'Identity documents required.' },
    });
    await repo.insertAuditEvent({
      tripRequestId: req.tripRequestId,
      bookingAttemptId: attempt.id,
      eventType: 'BOOKING_DOCUMENTS_REQUIRED',
      eventData: { offerId: req.offerId },
    });
    throw new ApiError(
      'DOCUMENTS_REQUIRED',
      'This sandbox offer requires identity documents, which this demo does not collect. Please select another offer.',
      { retryable: false, details: { bookingAttemptId: attempt.id } },
    );
  }

  // Price/currency must still match exactly what the user approved.
  const currencyChanged = currentCurrency !== req.acceptedCurrency;
  const amountChanged = !amountsEqual(currentAmount, req.acceptedAmount);
  if (amountChanged || currencyChanged) {
    await repo.updateBookingAttempt(attempt.id, 'PRICE_CHANGED');
    await repo.updateTripStatus(req.tripRequestId, 'PRICE_CHANGED');
    await repo.insertAuditEvent({
      tripRequestId: req.tripRequestId,
      bookingAttemptId: attempt.id,
      eventType: 'BOOKING_PRICE_CHANGED',
      eventData: {
        offerId: req.offerId,
        previousAmount: req.acceptedAmount,
        currentAmount,
        currency: currentCurrency,
      },
    });
    throw new ApiError(
      'PRICE_CHANGED',
      'The fare changed before booking. No reservation was made.',
      {
        retryable: false,
        details: {
          bookingAttemptId: attempt.id,
          previousAmount: req.acceptedAmount,
          currentAmount,
          currency: currentCurrency,
        },
      },
    );
  }

  if (!passengerId) {
    await markFailed(services, req, attempt, 'SUPPLIER_ERROR', 'Missing supplier passenger id.');
    throw new ApiError('SUPPLIER_ERROR', 'The supplier offer did not include a passenger id.', {
      retryable: false,
      details: { bookingAttemptId: attempt.id },
    });
  }

  // ── Create the order ──────────────────────────────────────────────────────
  await repo.updateBookingAttempt(attempt.id, 'BOOKING');
  await repo.insertAuditEvent({
    tripRequestId: req.tripRequestId,
    bookingAttemptId: attempt.id,
    eventType: 'BOOKING_ORDER_REQUESTED',
    eventData: { offerId: req.offerId },
  });

  const result = await supplier.createOrder({
    offerId: req.offerId,
    passengerId,
    amount: currentAmount,
    currency: currentCurrency,
    passenger: req.passenger, // used only to build the supplier request; never stored
    idempotencyKey: req.checkoutAttemptId,
  });

  const bookingStatus = bookingStatusFromOrderResult(result);

  const updatedAttempt = await repo.updateBookingAttempt(attempt.id, bookingStatus, {
    confirmed_amount: result.outcome === 'failed' ? null : currentAmount,
    currency: currentCurrency,
    supplier_order_id: result.supplierOrderId,
    booking_reference: result.bookingReference,
    supplier_http_status: result.httpStatus,
    supplier_response: result.safeResponse,
    error:
      result.outcome === 'failed'
        ? {
            code: result.errorCode ?? 'SUPPLIER_ERROR',
            message: result.errorMessage ?? 'Booking failed.',
          }
        : null,
  });

  const tripStatus =
    bookingStatus === 'CONFIRMED'
      ? 'CONFIRMED'
      : bookingStatus === 'PENDING_SUPPLIER'
        ? 'PENDING_SUPPLIER'
        : 'FAILED';
  await repo.updateTripStatus(req.tripRequestId, tripStatus, {
    error:
      tripStatus === 'FAILED'
        ? { code: result.errorCode ?? 'SUPPLIER_ERROR', message: 'Order creation failed.' }
        : null,
  });
  await repo.insertAuditEvent({
    tripRequestId: req.tripRequestId,
    bookingAttemptId: attempt.id,
    eventType: 'BOOKING_ORDER_COMPLETED',
    eventData: {
      offerId: req.offerId,
      outcome: result.outcome,
      httpStatus: result.httpStatus,
      supplierOrderId: result.supplierOrderId,
    },
  });

  return bookingAttemptToResponse(updatedAttempt);
}

async function finishExpired(
  services: Services,
  req: BookingRequest,
  attempt: BookingAttemptRow,
): Promise<never> {
  await services.repo.updateBookingAttempt(attempt.id, 'EXPIRED');
  await services.repo.updateTripStatus(req.tripRequestId, 'EXPIRED');
  await services.repo.insertAuditEvent({
    tripRequestId: req.tripRequestId,
    bookingAttemptId: attempt.id,
    eventType: 'BOOKING_OFFER_EXPIRED',
    eventData: { offerId: req.offerId },
  });
  throw new ApiError('OFFER_EXPIRED', 'This offer is no longer available. Run a new search.', {
    retryable: false,
    details: { bookingAttemptId: attempt.id },
  });
}

async function markFailed(
  services: Services,
  req: BookingRequest,
  attempt: BookingAttemptRow,
  code: string,
  message: string,
): Promise<void> {
  await services.repo.updateBookingAttempt(attempt.id, 'FAILED', { error: { code, message } });
  // The trip may be in BOOKING here; BOOKING → FAILED is a legal transition.
  const trip = await services.repo.getTripRequest(req.tripRequestId);
  if (trip && trip.status === 'BOOKING') {
    await services.repo.updateTripStatus(req.tripRequestId, 'FAILED', { error: { code, message } });
  }
}
