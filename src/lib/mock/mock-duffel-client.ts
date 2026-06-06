/**
 * Deterministic mock implementation of FlightSupplier. Enabled only via the
 * server TRAVEL_APP_MOCK_MODE flag. Caches offers produced by `search` so that
 * `getOffer` returns consistent data within a session, while specific offer IDs
 * trigger the price-change, pending, and failure scenarios.
 */
import type {
  CreateOrderInput,
  CreateOrderResult,
  FlightSupplier,
  SearchInput,
  SearchResult,
  SupplierOffer,
  SupplierOrder,
} from '@/lib/duffel/types';
import {
  buildMockOffer,
  buildMockOffers,
  DEFAULT_MOCK_CONTEXT,
  MOCK_OFFER_SPECS,
} from './fixtures';

export class MockDuffelClient implements FlightSupplier {
  readonly name = 'mock-duffel';
  readonly isMock = true;

  private cache = new Map<string, SupplierOffer>();

  constructor(private readonly now: () => number = () => Date.now()) {}

  async search(input: SearchInput): Promise<SearchResult> {
    const offers = buildMockOffers(input, this.now());
    for (const offer of offers) this.cache.set(offer.id, offer);
    return { offers, supplierRequestId: 'orq_mock_request' };
  }

  async getOffer(offerId: string): Promise<SupplierOffer> {
    const spec = MOCK_OFFER_SPECS.find((s) => s.id === offerId);
    if (!spec) {
      const cached = this.cache.get(offerId);
      if (cached) return cached;
      throw Object.assign(new Error('Mock offer not found.'), { status: 404 });
    }

    const base = this.cache.get(offerId) ?? buildMockOffer(spec, DEFAULT_MOCK_CONTEXT, this.now());

    // The price-change offer returns a higher amount on re-fetch.
    if (offerId === 'off_mock_pricechange') {
      return { ...base, total_amount: '478.50' };
    }
    // The expired offer reports an already-passed expiry on re-fetch.
    if (offerId === 'off_mock_expired') {
      return { ...base, expires_at: new Date(this.now() - 60_000).toISOString() };
    }
    return base;
  }

  async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    if (input.offerId === 'off_mock_pending') {
      return {
        outcome: 'pending',
        httpStatus: 202,
        supplierOrderId: 'ord_mock_pending',
        bookingReference: null,
        safeResponse: { id: 'ord_mock_pending', status: 'pending' },
      };
    }
    if (input.offerId === 'off_mock_fail') {
      return {
        outcome: 'failed',
        httpStatus: 422,
        supplierOrderId: null,
        bookingReference: null,
        safeResponse: { code: 'offer_no_longer_available' },
        errorCode: 'offer_no_longer_available',
        errorMessage: 'The selected mock offer could not be booked.',
      };
    }
    return {
      outcome: 'confirmed',
      httpStatus: 201,
      supplierOrderId: `ord_mock_${input.offerId}`,
      bookingReference: 'MOCK01',
      safeResponse: {
        id: `ord_mock_${input.offerId}`,
        booking_reference: 'MOCK01',
        status: 'confirmed',
        total_amount: input.amount,
        total_currency: input.currency,
      },
    };
  }

  async getOrder(orderId: string): Promise<SupplierOrder> {
    if (orderId === 'ord_mock_pending') {
      // On reconciliation the pending mock order becomes confirmed.
      return {
        id: orderId,
        booking_reference: 'MOCK02',
        status: 'confirmed',
      };
    }
    return { id: orderId, booking_reference: 'MOCK01', status: 'confirmed' };
  }
}
