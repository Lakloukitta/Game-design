/**
 * Small mapping helpers between supplier results and internal booking states.
 * Keeps the truthful interpretation of supplier responses in one place: we
 * never report CONFIRMED unless the supplier response actually establishes it.
 */
import type { BookingStatus } from '@/types/domain';
import type { CreateOrderResult, SupplierOrder } from './types';

export function bookingStatusFromOrderResult(result: CreateOrderResult): BookingStatus {
  switch (result.outcome) {
    case 'confirmed':
      return 'CONFIRMED';
    case 'pending':
      return 'PENDING_SUPPLIER';
    case 'failed':
    default:
      return 'FAILED';
  }
}

/** Re-reads a pending order and decides whether it is now confirmed. */
export function bookingStatusFromOrder(order: SupplierOrder): BookingStatus {
  const confirmed = Boolean(order.booking_reference) && order.status !== 'pending';
  return confirmed ? 'CONFIRMED' : 'PENDING_SUPPLIER';
}
