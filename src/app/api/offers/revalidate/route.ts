import type { NextRequest } from 'next/server';
import { handleRouteError, jsonOk, newRequestId } from '@/lib/api/response';
import { revalidateSchema } from '@/lib/validation/booking';
import { getServices } from '@/lib/services';
import { runRevalidate } from '@/lib/flows/revalidate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') ?? newRequestId();
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = revalidateSchema.parse(body);
    const result = await runRevalidate(getServices(), parsed);
    return jsonOk(result, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
