/**
 * Centralized, structured API error handling. All routes throw or construct
 * `ApiError` and serialize it with a single, safe shape. Stack traces and
 * secret details never reach the browser.
 */
import type { ApiErrorBody } from '@/types/api';

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'STATE_CONFLICT'
  | 'PRICE_CHANGED'
  | 'OFFER_EXPIRED'
  | 'DOCUMENTS_REQUIRED'
  | 'RATE_LIMITED'
  | 'INTERNAL'
  | 'SUPPLIER_ERROR'
  | 'SUPPLIER_TIMEOUT'
  | 'DEPENDENCY_UNAVAILABLE'
  | 'CONFIG_ERROR';

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  STATE_CONFLICT: 409,
  PRICE_CHANGED: 409,
  OFFER_EXPIRED: 409,
  DOCUMENTS_REQUIRED: 422,
  RATE_LIMITED: 429,
  INTERNAL: 500,
  SUPPLIER_ERROR: 502,
  DEPENDENCY_UNAVAILABLE: 503,
  CONFIG_ERROR: 503,
  SUPPLIER_TIMEOUT: 504,
};

export interface ApiErrorOptions {
  retryable?: boolean;
  fieldErrors?: Record<string, string[]>;
  details?: Record<string, unknown>;
  requestId?: string;
  /** Internal-only context for server logs; never serialized to the client. */
  internalCause?: unknown;
}

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly retryable: boolean;
  readonly fieldErrors?: Record<string, string[]>;
  readonly details?: Record<string, unknown>;
  requestId?: string;
  readonly internalCause?: unknown;

  constructor(code: ApiErrorCode, message: string, options: ApiErrorOptions = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.retryable = options.retryable ?? defaultRetryable(code);
    this.fieldErrors = options.fieldErrors;
    this.details = options.details;
    this.requestId = options.requestId;
    this.internalCause = options.internalCause;
  }

  toBody(): ApiErrorBody {
    return {
      error: {
        code: this.code,
        message: this.message,
        retryable: this.retryable,
        ...(this.fieldErrors ? { fieldErrors: this.fieldErrors } : {}),
        ...(this.details ? { details: this.details } : {}),
        ...(this.requestId ? { requestId: this.requestId } : {}),
      },
    };
  }
}

function defaultRetryable(code: ApiErrorCode): boolean {
  return (
    code === 'SUPPLIER_TIMEOUT' ||
    code === 'SUPPLIER_ERROR' ||
    code === 'DEPENDENCY_UNAVAILABLE' ||
    code === 'RATE_LIMITED'
  );
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}
