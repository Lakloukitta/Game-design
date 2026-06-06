/**
 * Helpers for building consistent JSON responses and translating thrown errors
 * into the structured API error shape. All route handlers funnel failures
 * through `handleRouteError`.
 */
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { ApiError, isApiError } from './errors';
import { SupplierConfigError } from '@/lib/config/env';
import { logger } from '@/lib/logging/logger';

export function jsonOk<T>(data: T, status = 200, requestId?: string): NextResponse {
  const res = NextResponse.json(data, { status });
  if (requestId) res.headers.set('x-request-id', requestId);
  // Supplier-backed responses must never be cached.
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

export function jsonError(error: ApiError): NextResponse {
  const res = NextResponse.json(error.toBody(), { status: error.status });
  if (error.requestId) res.headers.set('x-request-id', error.requestId);
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

export function newRequestId(): string {
  return crypto.randomUUID();
}

/** Converts a ZodError into structured field errors. */
function fieldErrorsFromZod(error: ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const path = issue.path.length > 0 ? issue.path.join('.') : '_root';
    (fieldErrors[path] ??= []).push(issue.message);
  }
  return fieldErrors;
}

/**
 * Single funnel for all route errors. Maps known error types to safe responses
 * and logs internal details server-side without leaking them to the client.
 */
export function handleRouteError(error: unknown, requestId: string): NextResponse {
  if (isApiError(error)) {
    error.requestId = error.requestId ?? requestId;
    if (error.status >= 500) {
      logger.error('Route error (ApiError)', {
        code: error.code,
        message: error.message,
        requestId,
        internalCause: serializeCause(error.internalCause),
      });
    } else {
      logger.warn('Route error (ApiError)', { code: error.code, requestId });
    }
    return jsonError(error);
  }

  if (error instanceof ZodError) {
    const apiError = new ApiError('VALIDATION_ERROR', 'The request did not pass validation.', {
      retryable: false,
      fieldErrors: fieldErrorsFromZod(error),
      requestId,
    });
    return jsonError(apiError);
  }

  if (error instanceof SupplierConfigError) {
    const apiError = new ApiError('CONFIG_ERROR', error.message, { retryable: false, requestId });
    return jsonError(apiError);
  }

  // Unknown / unexpected: log full detail server-side, return opaque 500.
  logger.error('Unhandled route error', {
    requestId,
    error: serializeCause(error),
  });
  const apiError = new ApiError('INTERNAL', 'An unexpected error occurred.', {
    retryable: true,
    requestId,
  });
  return jsonError(apiError);
}

function serializeCause(cause: unknown): unknown {
  if (cause instanceof Error) {
    return { name: cause.name, message: cause.message, stack: cause.stack };
  }
  return cause;
}
