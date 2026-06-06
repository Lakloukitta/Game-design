/**
 * Trip-search request validation. Centralized so both the API route and tests
 * share one schema. Origin/destination are normalized (trim + uppercase).
 */
import { z } from 'zod';
import type { TripSearchInput } from '@/types/domain';

const IATA_RE = /^[A-Z]{3}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Parses a YYYY-MM-DD string as a UTC calendar date (midnight). */
function parseCalendarDate(value: string): number {
  return Date.parse(`${value}T00:00:00.000Z`);
}

/** Today's date at UTC midnight, for "not in the past" comparisons. */
function todayUtcMidnight(): number {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

const iataCode = z
  .string({ required_error: 'Required.' })
  .transform((v) => v.trim().toUpperCase())
  .refine((v) => IATA_RE.test(v), 'Must be a 3-letter IATA code (e.g. LHR).');

const isoDate = z
  .string({ required_error: 'Required.' })
  .refine((v) => DATE_RE.test(v), 'Must be a date in YYYY-MM-DD format.')
  .refine((v) => !Number.isNaN(parseCalendarDate(v)), 'Invalid calendar date.');

export const tripSearchSchema = z
  .object({
    origin: iataCode,
    destination: iataCode,
    departureDate: isoDate,
    returnDate: isoDate,
    cabinClass: z.enum(['economy', 'premium_economy', 'business', 'first'], {
      errorMap: () => ({ message: 'Choose a valid cabin class.' }),
    }),
    maxConnections: z
      .number({ invalid_type_error: 'Must be a number.' })
      .int('Must be a whole number.')
      .min(0, 'Must be between 0 and 2.')
      .max(2, 'Must be between 0 and 2.'),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.origin === data.destination) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['destination'],
        message: 'Destination must differ from origin.',
      });
    }
    if (parseCalendarDate(data.departureDate) < todayUtcMidnight()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['departureDate'],
        message: 'Departure date must not be in the past.',
      });
    }
    if (parseCalendarDate(data.returnDate) <= parseCalendarDate(data.departureDate)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['returnDate'],
        message: 'Return date must be after the departure date.',
      });
    }
  });

export type TripSearchParsed = z.infer<typeof tripSearchSchema>;

export function parseTripSearch(input: unknown): TripSearchInput {
  const parsed = tripSearchSchema.parse(input);
  return {
    origin: parsed.origin,
    destination: parsed.destination,
    departureDate: parsed.departureDate,
    returnDate: parsed.returnDate,
    cabinClass: parsed.cabinClass,
    maxConnections: parsed.maxConnections as 0 | 1 | 2,
  };
}
