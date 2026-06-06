/** Date/time formatting helpers (display only). */

export function formatDateTime(iso: string): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return iso;
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(ts));
}

export function formatDate(iso: string): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return iso;
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(ts));
}

/** Returns whole minutes until `iso`; negative when already past. */
export function minutesUntil(iso: string, now: number = Date.now()): number {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return 0;
  return Math.round((ts - now) / 60000);
}

export function isExpired(iso: string, now: number = Date.now()): boolean {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return false;
  return ts <= now;
}
