import type { NextRequest } from 'next/server';
import { handleRouteError, jsonOk, newRequestId } from '@/lib/api/response';
import { parseTripSearch } from '@/lib/validation/trip';
import { getServices } from '@/lib/services';
import { runSearch } from '@/lib/flows/search';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') ?? newRequestId();
  try {
    const body = await request.json().catch(() => ({}));
    const input = parseTripSearch(body);
    const result = await runSearch(getServices(), input);
    return jsonOk(result, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
