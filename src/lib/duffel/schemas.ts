/**
 * Zod schemas that validate the subset of Duffel responses we consume. They are
 * intentionally permissive about unknown fields (the API has many) but strict
 * about the fields we depend on, so malformed offers are rejected rather than
 * silently passed through with invented values.
 */
import { z } from 'zod';

const carrierSchema = z
  .object({
    name: z.string(),
    iata_code: z.string().nullish(),
  })
  .passthrough();

const segmentSchema = z
  .object({
    departing_at: z.string(),
    arriving_at: z.string(),
    duration: z.string().nullish(),
    marketing_carrier: carrierSchema.nullish(),
    operating_carrier: carrierSchema.nullish(),
  })
  .passthrough();

const sliceSchema = z
  .object({
    duration: z.string().nullish(),
    segments: z.array(segmentSchema).min(1),
  })
  .passthrough();

export const supplierOfferSchema = z
  .object({
    id: z.string().min(1),
    total_amount: z.string().min(1),
    total_currency: z.string().min(1),
    expires_at: z.string().min(1),
    passenger_identity_documents_required: z.boolean().nullish(),
    owner: carrierSchema.nullish(),
    passengers: z
      .array(z.object({ id: z.string().min(1), type: z.string().optional() }).passthrough())
      .min(1),
    slices: z.array(sliceSchema).min(1),
  })
  .passthrough();

export const supplierOrderSchema = z
  .object({
    id: z.string().min(1),
    booking_reference: z.string().nullish(),
    status: z.string().nullish(),
    total_amount: z.string().nullish(),
    total_currency: z.string().nullish(),
  })
  .passthrough();

export const offerRequestResponseSchema = z.object({
  data: z
    .object({
      id: z.string().optional(),
      offers: z.array(supplierOfferSchema).optional(),
    })
    .passthrough(),
});

export const offerResponseSchema = z.object({ data: supplierOfferSchema });
export const orderResponseSchema = z.object({ data: supplierOrderSchema });
export const offersListResponseSchema = z.object({ data: z.array(supplierOfferSchema) });
