import { NextResponse } from 'next/server';
import { getServerEnv, isDatabaseConfigured, isDuffelConfigured } from '@/lib/config/env';
import type { HealthResponse } from '@/types/api';

// Always evaluated at request time; never statically cached.
export const dynamic = 'force-dynamic';

export function GET(): NextResponse {
  const env = getServerEnv();
  const databaseConfigured = isDatabaseConfigured(env);
  const duffelConfigured = isDuffelConfigured(env);

  // Usable when mock mode is on, or when both real dependencies are configured.
  const usable = env.mockMode || (databaseConfigured && duffelConfigured);

  const body: HealthResponse = {
    status: usable ? 'ok' : 'degraded',
    databaseConfigured,
    duffelConfigured,
    mockMode: env.mockMode,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(body, {
    status: usable ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
