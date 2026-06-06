/**
 * Typed, server-only Duffel API v2 client implementing the FlightSupplier
 * contract. Uses native fetch with a bounded timeout (AbortController), the
 * required Duffel-Version header, and safe error parsing. Never logs full
 * request bodies for passenger/booking endpoints and never logs secrets.
 */
import '@/lib/server/assert-server';
import { assertSupplierConfigured, getServerEnv } from '@/lib/config/env';
import { logger } from '@/lib/logging/logger';
import { offerRequestResponseSchema, offerResponseSchema, orderResponseSchema } from './schemas';
import type {
  CreateOrderInput,
  CreateOrderResult,
  FlightSupplier,
  SearchInput,
  SearchResult,
  SupplierOffer,
  SupplierOrder,
} from './types';

const DUFFEL_BASE_URL = 'https://api.duffel.com';
const DUFFEL_VERSION = 'v2';
const DEFAULT_TIMEOUT_MS = 25_000;

export interface DuffelApiErrorShape {
  message: string;
  status: number;
  supplierCode?: string;
  retryable: boolean;
  details?: Record<string, unknown>;
  requestId?: string;
}

export class DuffelApiError extends Error implements DuffelApiErrorShape {
  readonly status: number;
  readonly supplierCode?: string;
  readonly retryable: boolean;
  readonly details?: Record<string, unknown>;
  readonly requestId?: string;

  constructor(shape: DuffelApiErrorShape) {
    super(shape.message);
    this.name = 'DuffelApiError';
    this.status = shape.status;
    this.supplierCode = shape.supplierCode;
    this.retryable = shape.retryable;
    this.details = shape.details;
    this.requestId = shape.requestId;
  }
}

interface RequestOptions {
  method: 'GET' | 'POST';
  path: string;
  query?: Record<string, string>;
  body?: unknown;
  /** When true, the body is sensitive (passenger/order) and is never logged. */
  sensitive?: boolean;
  idempotencyKey?: string;
  timeoutMs?: number;
}

export class DuffelClient implements FlightSupplier {
  readonly name = 'duffel';
  readonly isMock = false;

  constructor(
    private readonly token: string = getServerEnv().duffelAccessToken ?? '',
    private readonly baseUrl: string = DUFFEL_BASE_URL,
  ) {
    assertSupplierConfigured();
  }

  private async request<T>(
    schema: { parse: (data: unknown) => T },
    options: RequestOptions,
  ): Promise<T> {
    const url = new URL(this.baseUrl + options.path);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      url.searchParams.set(key, value);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      'Duffel-Version': DUFFEL_VERSION,
      Accept: 'application/json',
    };
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    // Duffel officially supports the Idempotency-Key header on order creation.
    if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        method: options.method,
        headers,
        body: options.body !== undefined ? JSON.stringify({ data: options.body }) : undefined,
        cache: 'no-store',
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timeout);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new DuffelApiError({
          message: 'The flight supplier timed out. Please try again.',
          status: 504,
          retryable: true,
        });
      }
      throw new DuffelApiError({
        message: 'Could not reach the flight supplier.',
        status: 502,
        retryable: true,
        details: { reason: error instanceof Error ? error.message : 'unknown' },
      });
    } finally {
      clearTimeout(timeout);
    }

    const requestId = response.headers.get('x-request-id') ?? undefined;
    const rawText = await response.text();
    let json: unknown = undefined;
    if (rawText) {
      try {
        json = JSON.parse(rawText);
      } catch {
        throw new DuffelApiError({
          message: 'The flight supplier returned a malformed response.',
          status: 502,
          retryable: true,
          requestId,
        });
      }
    }

    if (!response.ok) {
      throw this.toError(response.status, json, requestId);
    }

    // Log only non-sensitive request metadata.
    if (!options.sensitive) {
      logger.debug('Duffel request ok', {
        method: options.method,
        path: options.path,
        status: response.status,
        requestId,
      });
    } else {
      logger.debug('Duffel sensitive request ok', {
        path: options.path,
        status: response.status,
        requestId,
      });
    }

    try {
      return schema.parse(json);
    } catch (error) {
      throw new DuffelApiError({
        message: 'The flight supplier response did not match the expected schema.',
        status: 502,
        retryable: false,
        requestId,
        details: { reason: error instanceof Error ? error.message : 'schema mismatch' },
      });
    }
  }

  private toError(status: number, json: unknown, requestId?: string): DuffelApiError {
    const firstError = extractFirstDuffelError(json);
    const retryable = status >= 500 || status === 429;
    return new DuffelApiError({
      message: firstError?.title
        ? `Supplier error: ${firstError.title}`
        : 'The flight supplier rejected the request.',
      status,
      supplierCode: firstError?.code,
      retryable,
      requestId,
      details: firstError?.documentation_url
        ? { documentation_url: firstError.documentation_url }
        : undefined,
    });
  }

  async search(input: SearchInput): Promise<SearchResult> {
    const body = {
      slices: [
        {
          origin: input.origin,
          destination: input.destination,
          departure_date: input.departureDate,
        },
        {
          origin: input.destination,
          destination: input.origin,
          departure_date: input.returnDate,
        },
      ],
      passengers: Array.from({ length: input.passengerCount }, () => ({ type: 'adult' })),
      cabin_class: input.cabinClass,
      max_connections: input.maxConnections,
    };

    const parsed = await this.request(offerRequestResponseSchema, {
      method: 'POST',
      path: '/air/offer_requests',
      query: { return_offers: 'true', supplier_timeout: '20000' },
      body,
    });

    return {
      offers: (parsed.data.offers ?? []) as SupplierOffer[],
      supplierRequestId: parsed.data.id ?? null,
    };
  }

  async getOffer(offerId: string): Promise<SupplierOffer> {
    const parsed = await this.request(offerResponseSchema, {
      method: 'GET',
      path: `/air/offers/${encodeURIComponent(offerId)}`,
      query: { return_available_services: 'false' },
    });
    return parsed.data as SupplierOffer;
  }

  async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    const body = {
      type: 'instant',
      selected_offers: [input.offerId],
      // Sandbox payment uses the Duffel test balance. No real card data.
      payments: [{ type: 'balance', amount: input.amount, currency: input.currency }],
      passengers: [
        {
          id: input.passengerId,
          title: input.passenger.title,
          gender: input.passenger.gender,
          given_name: input.passenger.givenName,
          family_name: input.passenger.familyName,
          born_on: input.passenger.bornOn,
          email: input.passenger.email,
          phone_number: input.passenger.phoneNumber,
        },
      ],
    };

    try {
      const parsed = await this.request(orderResponseSchema, {
        method: 'POST',
        path: '/air/orders',
        body,
        sensitive: true,
        idempotencyKey: input.idempotencyKey,
      });
      const order = parsed.data;
      // Duffel instant orders return a booking_reference when confirmed; an
      // order without one (or an explicitly non-confirmed status) is treated as
      // pending and must be reconciled later.
      const confirmed = Boolean(order.booking_reference) && order.status !== 'pending';
      return {
        outcome: confirmed ? 'confirmed' : 'pending',
        httpStatus: 201,
        supplierOrderId: order.id,
        bookingReference: order.booking_reference ?? null,
        safeResponse: {
          id: order.id,
          booking_reference: order.booking_reference ?? null,
          status: order.status ?? null,
          total_amount: order.total_amount ?? null,
          total_currency: order.total_currency ?? null,
        },
      };
    } catch (error) {
      if (error instanceof DuffelApiError) {
        return {
          outcome: 'failed',
          httpStatus: error.status,
          supplierOrderId: null,
          bookingReference: null,
          safeResponse: { code: error.supplierCode ?? null, requestId: error.requestId ?? null },
          errorCode: error.supplierCode ?? 'SUPPLIER_ERROR',
          errorMessage: error.message,
        };
      }
      throw error;
    }
  }

  async getOrder(orderId: string): Promise<SupplierOrder> {
    const parsed = await this.request(orderResponseSchema, {
      method: 'GET',
      path: `/air/orders/${encodeURIComponent(orderId)}`,
    });
    return parsed.data as SupplierOrder;
  }
}

interface DuffelErrorEntry {
  title?: string;
  code?: string;
  documentation_url?: string;
}

function extractFirstDuffelError(json: unknown): DuffelErrorEntry | undefined {
  if (json && typeof json === 'object' && 'errors' in json) {
    const errors = (json as { errors?: unknown }).errors;
    if (Array.isArray(errors) && errors.length > 0 && typeof errors[0] === 'object') {
      return errors[0] as DuffelErrorEntry;
    }
  }
  return undefined;
}
