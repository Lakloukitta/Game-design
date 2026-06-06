import type { NextRequest } from 'next/server';
import { handleRouteError, jsonOk, newRequestId } from '@/lib/api/response';
import { getServices } from '@/lib/services';
import { getBookingStatus } from '@/lib/flows/booking-status';
import { ApiError } from '@/lib/api/errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ bookingAttemptId: string }> },
) {
  const requestId = request.headers.get('x-request-id') ?? newRequestId();
  try {
    const { bookingAttemptId } = await context.params;
    if (!/^[0-9a-f-]{36}$/i.test(bookingAttemptId)) {
      throw new ApiError('VALIDATION_ERROR', 'Invalid booking attempt id.', { retryable: false });
    }
    const result = await getBookingStatus(getServices(), bookingAttemptId);
    return jsonOk(result, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
