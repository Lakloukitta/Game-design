import type { Services } from '@/lib/services';
import type { FlightSupplier, SupplierOffer } from '@/lib/duffel/types';
import { InMemoryRepository } from '@/lib/database/memory-repository';
import { MockDuffelClient } from '@/lib/mock/mock-duffel-client';

export interface TestServices extends Services {
  repo: InMemoryRepository;
}

export function makeTestServices(supplier?: FlightSupplier): TestServices {
  const repo = new InMemoryRepository();
  return {
    repo,
    supplier: supplier ?? new MockDuffelClient(),
    mockMode: true,
  };
}

/**
 * Returns a full FlightSupplier (based on the mock client) with `getOffer`
 * overridden, so tests can simulate price/currency/expiry changes without
 * constructing a partial object.
 */
export function supplierWithGetOffer(
  getOffer: (id: string) => Promise<SupplierOffer>,
): FlightSupplier {
  const supplier = new MockDuffelClient();
  supplier.getOffer = getOffer;
  return supplier;
}

export const SAMPLE_SEARCH = {
  origin: 'LHR',
  destination: 'JFK',
  departureDate: '2032-05-01',
  returnDate: '2032-05-08',
  cabinClass: 'economy' as const,
  maxConnections: 1 as const,
};

export const SAMPLE_PASSENGER = {
  title: 'mr' as const,
  gender: 'm' as const,
  givenName: 'Test',
  familyName: 'Traveller',
  bornOn: '1990-01-01',
  email: 'test@example.com',
  phoneNumber: '+14155550123',
};
