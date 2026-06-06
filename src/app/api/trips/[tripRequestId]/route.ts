import type { NextRequest } from 'next/server';
import { handleRouteError, jsonOk, newRequestId } from '@/lib/api/response';
import { getServices } from '@/lib/services';
import { getTripStatus } from '@/lib/flows/trip-status';
import { ApiError } from '@/lib/api/errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ tripRequestId: string }> },
) {
  const requestId = request.headers.get('x-request-id') ?? newRequestId();
  try {
    const { tripRequestId } = await context.params;
    if (!/^[0-9a-f-]{36}$/i.test(tripRequestId)) {
      throw new ApiError('VALIDATION_ERROR', 'Invalid trip id.', { retryable: false });
    }
    const result = await getTripStatus(getServices(), tripRequestId);
    return jsonOk(result, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
