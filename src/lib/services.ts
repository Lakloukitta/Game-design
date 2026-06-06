/**
 * Server-side dependency factory. Routes call `getServices()` to obtain a
 * supplier + repository pair. Tests construct services directly with injected
 * fakes, so route handlers stay free of construction logic.
 */
import '@/lib/server/assert-server';
import { getServerEnv, isDatabaseConfigured } from '@/lib/config/env';
import { logger } from '@/lib/logging/logger';
import type { FlightSupplier } from '@/lib/duffel/types';
import type { TripRepository } from '@/lib/database/types';
import { DuffelClient } from '@/lib/duffel/client';
import { MockDuffelClient } from '@/lib/mock/mock-duffel-client';
import { SupabaseRepository } from '@/lib/database/supabase-repository';
import { InMemoryRepository } from '@/lib/database/memory-repository';

export interface Services {
  supplier: FlightSupplier;
  repo: TripRepository;
  mockMode: boolean;
}

let cachedSupplier: FlightSupplier | null = null;
let cachedMemoryRepo: InMemoryRepository | null = null;

export function getSupplier(): FlightSupplier {
  if (cachedSupplier) return cachedSupplier;
  const env = getServerEnv();
  cachedSupplier = env.mockMode ? new MockDuffelClient() : new DuffelClient();
  return cachedSupplier;
}

function getRepository(): TripRepository {
  const env = getServerEnv();
  // In mock mode without a configured database, fall back to an in-process
  // in-memory repository so the full flow runs locally with zero credentials.
  // This data is ephemeral and resets when the server restarts.
  if (env.mockMode && !isDatabaseConfigured(env)) {
    if (!cachedMemoryRepo) {
      cachedMemoryRepo = new InMemoryRepository();
      logger.warn('Using in-memory repository (mock mode, no database configured).');
    }
    return cachedMemoryRepo;
  }
  return new SupabaseRepository();
}

export function getServices(): Services {
  const env = getServerEnv();
  return {
    supplier: getSupplier(),
    repo: getRepository(),
    mockMode: env.mockMode,
  };
}
