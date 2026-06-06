/**
 * Application-level idempotency helpers for booking submission.
 *
 * The browser generates one `checkoutAttemptId` (UUID) per approved commercial
 * decision and reuses it across network retries of unknown outcome. The server
 * uses it as the unique `idempotency_key`. If an attempt already exists, the
 * existing state is returned and the supplier is NOT called again. A new key is
 * only used after the user explicitly approves a genuinely new price.
 */
import type { BookingAttemptRow } from '@/lib/database/types';

/**
 * When an attempt already exists for a key, decide whether the server may keep
 * driving it forward or must simply echo its current state. Any attempt past
 * the initial CREATED state — or in a terminal state — is echoed as-is so a
 * duplicate request never triggers a second supplier call.
 */
export function shouldEchoExisting(attempt: BookingAttemptRow): boolean {
  return attempt.status !== 'CREATED';
}
