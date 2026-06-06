import type { NextRequest } from 'next/server';
import { handleRouteError, jsonOk, newRequestId } from '@/lib/api/response';
import { bookingSchema } from '@/lib/validation/booking';
import { parsePassenger } from '@/lib/validation/passenger';
import { getServices } from '@/lib/services';
import { runBooking } from '@/lib/flows/booking';
import { ApiError } from '@/lib/api/errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/bookings/test — create one idempotent Duffel TEST order attempt.
 * The passenger body is validated here and forwarded to the supplier flow but
 * is never persisted or logged.
 */
export async function POST(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') ?? newRequestId();
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = bookingSchema.parse(body);

    const services = getServices();
    // The trip's departure date is needed to enforce the adult-age rule.
    const trip = await services.repo.getTripRequest(parsed.tripRequestId);
    if (!trip) throw new ApiError('NOT_FOUND', 'Trip request not found.', { retryable: false });
    parsePassenger(parsed.passenger, trip.departure_date);

    const result = await runBooking(services, parsed);
    return jsonOk(result, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
