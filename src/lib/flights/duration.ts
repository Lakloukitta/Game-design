/**
 * Safe ISO 8601 duration parsing for flight durations (e.g. "PT2H30M",
 * "P1DT3H5M"). Returns minutes. Throws on malformed/missing input so callers
 * can fall back to computing duration from segment timestamps rather than
 * silently assigning an invented value.
 */

export class DurationParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DurationParseError';
  }
}

// Matches ISO 8601 durations. We support weeks, days, hours, minutes, seconds.
// Years/months are not meaningful for flight durations and are rejected.
const ISO_DURATION_RE =
  /^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/;

export function parseIso8601DurationToMinutes(value: string | null | undefined): number {
  if (value === null || value === undefined || value.trim() === '') {
    throw new DurationParseError('Duration value is missing.');
  }

  const trimmed = value.trim();
  const match = ISO_DURATION_RE.exec(trimmed);
  if (!match) {
    throw new DurationParseError(`Malformed ISO 8601 duration: "${trimmed}".`);
  }

  const [, weeks, days, hours, minutes, seconds] = match;

  // A bare "P" or "PT" with no components is malformed.
  if (!weeks && !days && !hours && !minutes && !seconds) {
    throw new DurationParseError(`Empty ISO 8601 duration: "${trimmed}".`);
  }

  const totalMinutes =
    toInt(weeks) * 7 * 24 * 60 +
    toInt(days) * 24 * 60 +
    toInt(hours) * 60 +
    toInt(minutes) +
    toFloat(seconds) / 60;

  return Math.round(totalMinutes);
}

/**
 * Non-throwing variant: returns minutes or null. Useful when a fallback path
 * exists (e.g. computing from segment timestamps).
 */
export function tryParseIso8601DurationToMinutes(value: string | null | undefined): number | null {
  try {
    return parseIso8601DurationToMinutes(value);
  } catch {
    return null;
  }
}

function toInt(value: string | undefined): number {
  return value ? parseInt(value, 10) : 0;
}

function toFloat(value: string | undefined): number {
  return value ? parseFloat(value) : 0;
}

/** Minutes between two ISO timestamps, used as a fallback for missing durations. */
export function minutesBetween(startIso: string, endIso: string): number {
  const start = Date.parse(startIso);
  const end = Date.parse(endIso);
  if (Number.isNaN(start) || Number.isNaN(end)) {
    throw new DurationParseError('Invalid timestamp when computing duration from segments.');
  }
  return Math.round((end - start) / 60000);
}
