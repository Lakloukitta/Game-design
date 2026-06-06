/**
 * Recursively redacts sensitive keys from arbitrary objects before logging.
 * Used everywhere structured objects of unknown shape are logged.
 */
const SENSITIVE_KEY_PATTERNS = [
  'token',
  'authorization',
  'secret',
  'password',
  'card',
  'passport',
  'passenger',
  'email',
  'phone',
  'born_on',
  'bornon',
];

const REDACTED = '[REDACTED]';

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SENSITIVE_KEY_PATTERNS.some((pattern) => lower.includes(pattern));
}

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[TRUNCATED]';
  if (value === null || value === undefined) return value;

  if (Array.isArray(value)) {
    return value.map((item) => redact(item, depth + 1));
  }

  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = isSensitiveKey(key) ? REDACTED : redact(val, depth + 1);
    }
    return out;
  }

  return value;
}

/** Masks a secret to a short, non-reversible hint suitable for logs. */
export function maskSecret(secret: string | undefined): string {
  if (!secret) return '(unset)';
  if (secret.length <= 8) return '****';
  return `${secret.slice(0, 4)}…(${secret.length} chars)`;
}
