/** Validation for revalidation and booking request bodies. */
import { z } from 'zod';
import { passengerSchema } from './passenger';

const amountText = z.union([z.string(), z.number()]).transform((v) => String(v).trim());
const currencyCode = z
  .string()
  .transform((v) => v.trim().toUpperCase())
  .refine((v) => /^[A-Z]{3}$/.test(v), 'Must be a 3-letter currency code.');

export const revalidateSchema = z
  .object({
    tripRequestId: z.string().uuid('Invalid trip id.'),
    offerId: z.string().min(1, 'Offer id is required.'),
    previouslyDisplayedAmount: amountText,
    previouslyDisplayedCurrency: currencyCode,
  })
  .strict();

export const bookingSchema = z
  .object({
    tripRequestId: z.string().uuid('Invalid trip id.'),
    offerId: z.string().min(1, 'Offer id is required.'),
    checkoutAttemptId: z.string().uuid('Invalid checkout attempt id.'),
    acceptedAmount: amountText.refine(
      (v) => Number.isFinite(Number(v)) && Number(v) > 0,
      'Accepted amount must be a positive number.',
    ),
    acceptedCurrency: currencyCode,
    passenger: passengerSchema,
  })
  .strict();

export type RevalidateRequest = z.infer<typeof revalidateSchema>;
export type BookingRequest = z.infer<typeof bookingSchema>;
