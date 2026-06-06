/**
 * Revalidation orchestration: re-fetch the selected offer from the supplier,
 * detect expiry/availability/price/currency changes, update the stored offer
 * with authoritative data, and move the trip to APPROVED, PRICE_CHANGED, or
 * EXPIRED. Never proceeds automatically when price or currency changed.
 */
import type { Services } from '@/lib/services';
import type { RevalidateResponse } from '@/types/api';
import { ApiError } from '@/lib/api/errors';
import { amountsEqual } from '@/lib/formatting/currency';
import { isExpired } from '@/lib/formatting/date-time';
import { normalizeOffer } from '@/lib/flights/normalize';
import type { RevalidateRequest } from '@/lib/validation/booking';

export async function runRevalidate(
  services: Services,
  req: RevalidateRequest,
  now: number = Date.now(),
): Promise<RevalidateResponse> {
  const { repo, supplier } = services;

  const trip = await repo.getTripRequest(req.tripRequestId);
  if (!trip) throw new ApiError('NOT_FOUND', 'Trip request not found.', { retryable: false });

  const storedOffer = await repo.getOffer(req.tripRequestId, req.offerId);
  if (!storedOffer) {
    throw new ApiError('NOT_FOUND', 'That offer does not belong to this trip.', {
      retryable: false,
    });
  }

  if (trip.status !== 'PROPOSAL_READY' && trip.status !== 'PRICE_CHANGED') {
    throw new ApiError('STATE_CONFLICT', `Trip cannot be revalidated from state ${trip.status}.`, {
      retryable: false,
      details: { status: trip.status },
    });
  }

  // PRICE_CHANGED → REVALIDATING requires a renewed approval; PROPOSAL_READY →
  // REVALIDATING is the normal path. Both are legal trip transitions.
  await repo.updateTripStatus(req.tripRequestId, 'REVALIDATING');
  await repo.insertAuditEvent({
    tripRequestId: req.tripRequestId,
    eventType: 'OFFER_REVALIDATION_STARTED',
    eventData: { offerId: req.offerId },
  });

  // Fetch authoritative current offer.
  let currentAmount = storedOffer.total_amount;
  let currentCurrency = storedOffer.currency;
  let expiresAt = storedOffer.expires_at;
  let identityDocumentsRequired = false;
  let available = true;
  let expired = false;

  try {
    const supplierOffer = await supplier.getOffer(req.offerId);
    const normalized = normalizeOffer(supplierOffer);
    currentAmount = normalized.amountText;
    currentCurrency = normalized.currency;
    expiresAt = normalized.expiresAt;
    identityDocumentsRequired = normalized.passengerIdentityDocumentsRequired;
    expired = isExpired(expiresAt, now);

    await repo.updateOffer(req.tripRequestId, req.offerId, {
      total_amount: currentAmount,
      currency: currentCurrency,
      expires_at: expiresAt,
      raw: normalized.raw,
    });
  } catch (error) {
    // A 404 / unavailable offer means it can no longer be booked.
    const status = (error as { status?: number }).status;
    if (status === 404) {
      available = false;
      expired = true;
    } else {
      // Unexpected supplier failure: revert nothing, surface a controlled error.
      await repo.updateTripStatus(req.tripRequestId, 'FAILED', {
        error: { code: 'SUPPLIER_ERROR', message: 'Revalidation failed at the supplier.' },
      });
      throw new ApiError('SUPPLIER_ERROR', 'Could not revalidate the offer with the supplier.', {
        retryable: true,
        internalCause: error,
      });
    }
  }

  const currencyChanged = currentCurrency !== req.previouslyDisplayedCurrency;
  const amountChanged = !amountsEqual(currentAmount, req.previouslyDisplayedAmount);
  const changed = amountChanged || currencyChanged;

  let nextStatus: 'APPROVED' | 'PRICE_CHANGED' | 'EXPIRED';
  if (expired || !available) {
    nextStatus = 'EXPIRED';
  } else if (changed) {
    nextStatus = 'PRICE_CHANGED';
  } else {
    nextStatus = 'APPROVED';
  }

  await repo.updateTripStatus(req.tripRequestId, nextStatus);
  await repo.insertAuditEvent({
    tripRequestId: req.tripRequestId,
    eventType: 'OFFER_REVALIDATED',
    eventData: {
      offerId: req.offerId,
      changed,
      expired: expired || !available,
      result: nextStatus,
    },
  });

  return {
    tripRequestId: req.tripRequestId,
    offerId: req.offerId,
    currentAmount,
    previousAmount: req.previouslyDisplayedAmount,
    currency: currentCurrency,
    changed,
    expired: expired || !available,
    available,
    identityDocumentsRequired,
    expiresAt,
  };
}
