/**
 * Returns safe booking-attempt status. When the attempt is PENDING_SUPPLIER and
 * a supplier order id exists, optionally reconciles by re-reading the order and
 * promoting to CONFIRMED if the supplier now establishes confirmation.
 */
import type { Services } from '@/lib/services';
import type { BookingStatusResponse } from '@/types/api';
import { ApiError } from '@/lib/api/errors';
import { bookingAttemptToResponse } from '@/lib/api/presenters';
import { bookingStatusFromOrder } from '@/lib/duffel/mapper';
import { logger } from '@/lib/logging/logger';

export async function getBookingStatus(
  services: Services,
  bookingAttemptId: string,
): Promise<BookingStatusResponse> {
  const { repo, supplier } = services;
  const attempt = await repo.getBookingAttempt(bookingAttemptId);
  if (!attempt) {
    throw new ApiError('NOT_FOUND', 'Booking attempt not found.', { retryable: false });
  }

  // Controlled reconciliation of a pending order.
  if (attempt.status === 'PENDING_SUPPLIER' && attempt.supplier_order_id && supplier.getOrder) {
    try {
      const order = await supplier.getOrder(attempt.supplier_order_id);
      const next = bookingStatusFromOrder(order);
      if (next === 'CONFIRMED') {
        const updated = await repo.updateBookingAttempt(attempt.id, 'CONFIRMED', {
          booking_reference: order.booking_reference ?? attempt.booking_reference,
        });
        const trip = await repo.getTripRequest(attempt.trip_request_id);
        if (trip && trip.status === 'PENDING_SUPPLIER') {
          await repo.updateTripStatus(attempt.trip_request_id, 'CONFIRMED');
        }
        await repo.insertAuditEvent({
          tripRequestId: attempt.trip_request_id,
          bookingAttemptId: attempt.id,
          eventType: 'BOOKING_RECONCILED_CONFIRMED',
          eventData: { supplierOrderId: attempt.supplier_order_id },
        });
        return bookingAttemptToResponse(updated);
      }
    } catch (error) {
      // Reconciliation is best-effort; never fail the status read because of it.
      logger.warn('Pending order reconciliation failed', {
        bookingAttemptId,
        error: String(error),
      });
    }
  }

  return bookingAttemptToResponse(attempt);
}
