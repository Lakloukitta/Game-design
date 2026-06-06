/**
 * Browser-side API client. Imports only browser-safe types. Throws `ApiClientError`
 * carrying the structured error body so the UI can render field errors and the
 * specific PRICE_CHANGED / OFFER_EXPIRED / DOCUMENTS_REQUIRED cases.
 */
import type {
  ApiErrorBody,
  BookingStatusResponse,
  RevalidateResponse,
  SearchResponse,
  TripStatusResponse,
} from '@/types/api';
import type { PassengerInput, TripSearchInput } from '@/types/domain';

export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiErrorBody['error'],
  ) {
    super(body.message);
    this.name = 'ApiClientError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ApiClientError(0, {
      code: 'NETWORK',
      message: 'Could not reach the server. Check your connection and try again.',
      retryable: true,
    });
  }

  const text = await response.text();
  const json = text ? JSON.parse(text) : {};

  if (!response.ok) {
    const body = (json as ApiErrorBody).error ?? {
      code: 'UNKNOWN',
      message: 'Request failed.',
      retryable: false,
    };
    throw new ApiClientError(response.status, body);
  }
  return json as T;
}

export const api = {
  search: (input: TripSearchInput) =>
    request<SearchResponse>('/api/trips/search', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  getTrip: (tripRequestId: string) => request<TripStatusResponse>(`/api/trips/${tripRequestId}`),

  revalidate: (input: {
    tripRequestId: string;
    offerId: string;
    previouslyDisplayedAmount: string;
    previouslyDisplayedCurrency: string;
  }) =>
    request<RevalidateResponse>('/api/offers/revalidate', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  book: (input: {
    tripRequestId: string;
    offerId: string;
    checkoutAttemptId: string;
    acceptedAmount: string;
    acceptedCurrency: string;
    passenger: PassengerInput;
  }) =>
    request<BookingStatusResponse>('/api/bookings/test', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  getBooking: (bookingAttemptId: string) =>
    request<BookingStatusResponse>(`/api/bookings/${bookingAttemptId}`),
};
