/**
 * Server-only privileged Supabase client. NEVER import this from a "use client"
 * file. The privileged key is read from server env and never exposed in errors.
 */
import '@/lib/server/assert-server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { assertDatabaseConfigured, getServerEnv } from '@/lib/config/env';
import { ApiError } from '@/lib/api/errors';

let cached: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;

  const env = getServerEnv();
  assertDatabaseConfigured(env);

  cached = createClient(env.supabaseUrl!, env.supabaseSecretKey!, {
    auth: {
      // Server-side service client: never persist or refresh user sessions.
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: { 'x-application': 'trip-autopilot' },
    },
  });

  return cached;
}

/** Normalizes an unknown Supabase/postgres error into a safe ApiError. */
export function databaseError(message: string, cause: unknown): ApiError {
  return new ApiError('DEPENDENCY_UNAVAILABLE', message, {
    retryable: true,
    internalCause: cause,
  });
}
