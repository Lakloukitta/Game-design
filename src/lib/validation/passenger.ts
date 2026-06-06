/**
 * Synthetic passenger validation. The passenger body is never persisted; this
 * schema only validates the shape before mapping to the supplier passenger ID.
 */
import { z } from 'zod';
import type { PassengerInput } from '@/types/domain';

// Duffel name fields accept letters, spaces, hyphens and apostrophes; reject
// digits and most punctuation. Keep lengths within supplier limits.
const NAME_RE = /^[A-Za-z][A-Za-z \-']{0,38}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// Pragmatic email check (full RFC validation is unnecessary here).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// E.164-like: a leading + and 8–15 digits.
const PHONE_RE = /^\+[1-9]\d{7,14}$/;

const nameField = (label: string) =>
  z
    .string({ required_error: `${label} is required.` })
    .transform((v) => v.trim())
    .refine((v) => v.length > 0, `${label} is required.`)
    .refine((v) => NAME_RE.test(v), `${label} contains unsupported characters.`);

export const ADULT_MIN_YEARS = 18;

/** Whole years between two calendar dates (UTC), as of `asOf`. */
export function ageInYears(bornOn: string, asOf: string): number {
  const born = new Date(`${bornOn}T00:00:00.000Z`);
  const ref = new Date(`${asOf}T00:00:00.000Z`);
  let age = ref.getUTCFullYear() - born.getUTCFullYear();
  const monthDiff = ref.getUTCMonth() - born.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && ref.getUTCDate() < born.getUTCDate())) {
    age -= 1;
  }
  return age;
}

export const passengerSchema = z
  .object({
    title: z.enum(['mr', 'mrs', 'ms', 'miss', 'dr'], {
      errorMap: () => ({ message: 'Choose a valid title.' }),
    }),
    gender: z.enum(['m', 'f'], { errorMap: () => ({ message: 'Choose a gender.' }) }),
    givenName: nameField('Given name'),
    familyName: nameField('Family name'),
    bornOn: z
      .string({ required_error: 'Date of birth is required.' })
      .refine((v) => DATE_RE.test(v), 'Use YYYY-MM-DD.')
      .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00.000Z`)), 'Invalid date of birth.'),
    email: z
      .string({ required_error: 'Email is required.' })
      .transform((v) => v.trim())
      .refine((v) => EMAIL_RE.test(v), 'Enter a valid email address.'),
    phoneNumber: z
      .string({ required_error: 'Phone number is required.' })
      .transform((v) => v.replace(/[\s()-]/g, ''))
      .refine((v) => PHONE_RE.test(v), 'Use international format, e.g. +14155550123.'),
  })
  .strict();

/**
 * Validates the passenger and additionally checks they are an adult on the
 * departure date (supplied separately so the rule is explicit and testable).
 */
export function parsePassenger(input: unknown, departureDate: string): PassengerInput {
  const parsed = passengerSchema.parse(input);
  const age = ageInYears(parsed.bornOn, departureDate);
  if (age < ADULT_MIN_YEARS) {
    throw new z.ZodError([
      {
        code: z.ZodIssueCode.custom,
        path: ['bornOn'],
        message: `Passenger must be at least ${ADULT_MIN_YEARS} on the departure date.`,
      },
    ]);
  }
  return parsed;
}
