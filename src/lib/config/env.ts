/**
 * Centralized, validated environment configuration.
 *
 * This module is the single source of truth for runtime configuration. It is
 * intended to be imported only from server-side code. The only value that may
 * ever reach the browser is NEXT_PUBLIC_SUPABASE_URL (and the public mock-mode
 * hint), both read directly from `process.env` where needed on the client.
 */
import { z } from 'zod';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export interface ServerEnv {
  duffelAccessToken: string | undefined;
  supabaseUrl: string | undefined;
  supabaseSecretKey: string | undefined;
  mockMode: boolean;
  duffelWebhookSecret: string | undefined;
  logLevel: LogLevel;
}

const booleanFromString = (value: string | undefined): boolean =>
  value?.trim().toLowerCase() === 'true';

const logLevelSchema = z.enum(['error', 'warn', 'info', 'debug']).catch('info');

/**
 * Reads and normalizes server environment. Does not throw on missing supplier
 * credentials so that the health endpoint and mock mode can still operate;
 * call `assertSupplierConfigured()` before performing real supplier work.
 */
export function getServerEnv(): ServerEnv {
  const mockMode = booleanFromString(process.env.TRAVEL_APP_MOCK_MODE);

  // Prefer the modern secret-key model; fall back to the legacy service-role key.
  const supabaseSecretKey =
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    undefined;

  return {
    duffelAccessToken: process.env.DUFFEL_ACCESS_TOKEN?.trim() || undefined,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || undefined,
    supabaseSecretKey,
    mockMode,
    duffelWebhookSecret: process.env.DUFFEL_WEBHOOK_SECRET?.trim() || undefined,
    logLevel: logLevelSchema.parse(process.env.LOG_LEVEL),
  };
}

export function isMockMode(): boolean {
  return booleanFromString(process.env.TRAVEL_APP_MOCK_MODE);
}

export function isDatabaseConfigured(env: ServerEnv = getServerEnv()): boolean {
  return Boolean(env.supabaseUrl && env.supabaseSecretKey);
}

export function isDuffelConfigured(env: ServerEnv = getServerEnv()): boolean {
  return Boolean(env.duffelAccessToken);
}

/**
 * A token is considered test-mode when it carries the Duffel test prefix.
 * Duffel test access tokens are prefixed with `duffel_test_`; live tokens use
 * `duffel_live_`. We refuse anything that is not clearly a test token.
 */
export function isDuffelTestToken(token: string | undefined): boolean {
  if (!token) return false;
  return token.startsWith('duffel_test_');
}

export class SupplierConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SupplierConfigError';
  }
}

/**
 * Guards real supplier operations. In mock mode it is a no-op. Otherwise it
 * requires a present token that clearly belongs to Duffel test mode and refuses
 * to continue with a live-mode token.
 */
export function assertSupplierConfigured(env: ServerEnv = getServerEnv()): void {
  if (env.mockMode) return;

  if (!env.duffelAccessToken) {
    throw new SupplierConfigError(
      'DUFFEL_ACCESS_TOKEN is not configured. Set a Duffel test token or enable TRAVEL_APP_MOCK_MODE=true.',
    );
  }

  if (env.duffelAccessToken.startsWith('duffel_live_')) {
    throw new SupplierConfigError(
      'A Duffel LIVE token was provided. This application refuses to operate against live inventory. Use a duffel_test_ token.',
    );
  }

  if (!isDuffelTestToken(env.duffelAccessToken)) {
    throw new SupplierConfigError(
      'DUFFEL_ACCESS_TOKEN does not clearly belong to Duffel test mode (expected a "duffel_test_" prefix). Refusing to start supplier operations.',
    );
  }
}

export function assertDatabaseConfigured(env: ServerEnv = getServerEnv()): void {
  if (!env.supabaseUrl) {
    throw new SupplierConfigError('NEXT_PUBLIC_SUPABASE_URL is not configured.');
  }
  if (!env.supabaseSecretKey) {
    throw new SupplierConfigError(
      'No Supabase server key configured. Set SUPABASE_SECRET_KEY (preferred) or SUPABASE_SERVICE_ROLE_KEY.',
    );
  }
}
