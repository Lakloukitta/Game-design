/** Human-readable duration formatting (display only). */

export function formatDurationMinutes(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return '—';
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export function formatStops(maxStops: number): string {
  if (maxStops <= 0) return 'Nonstop';
  if (maxStops === 1) return '1 stop';
  return `${maxStops} stops`;
}
