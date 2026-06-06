/**
 * Core domain types. These are the application's own normalized shapes and are
 * intentionally decoupled from raw supplier (Duffel) JSON.
 */

export type CabinClass = 'economy' | 'premium_economy' | 'business' | 'first';

export type MaxConnections = 0 | 1 | 2;

export const TRIP_STATUSES = [
  'DRAFT',
  'SEARCHING',
  'PROPOSAL_READY',
  'REVALIDATING',
  'APPROVED',
  'BOOKING',
  'CONFIRMED',
  'PENDING_SUPPLIER',
  'PRICE_CHANGED',
  'EXPIRED',
  'FAILED',
] as const;
export type TripStatus = (typeof TRIP_STATUSES)[number];

export const BOOKING_STATUSES = [
  'CREATED',
  'REVALIDATING',
  'BOOKING',
  'CONFIRMED',
  'PENDING_SUPPLIER',
  'PRICE_CHANGED',
  'EXPIRED',
  'FAILED',
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const PROPOSAL_LABELS = [
  'Best overall',
  'Lowest price',
  'Shortest journey',
  'Strong alternative',
] as const;
export type ProposalLabel = (typeof PROPOSAL_LABELS)[number];

export interface TripSearchInput {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate: string;
  cabinClass: CabinClass;
  maxConnections: MaxConnections;
}

export interface PassengerInput {
  title: 'mr' | 'mrs' | 'ms' | 'miss' | 'dr';
  gender: 'm' | 'f';
  givenName: string;
  familyName: string;
  bornOn: string;
  email: string;
  phoneNumber: string;
}

/**
 * Internal normalized representation of a single supplier offer. `totalAmount`
 * is a float used only for ranking/display; `amountText` preserves the exact
 * decimal string required for supplier operations.
 */
export interface NormalizedOffer {
  offerId: string;
  airlineName: string;
  marketingCarriers: string[];
  operatingCarriers: string[];
  totalAmount: number;
  amountText: string;
  currency: string;
  durationMinutes: number;
  maxStops: number;
  departureAt: string;
  finalArrivalAt: string;
  expiresAt: string;
  passengerIdentityDocumentsRequired: boolean;
  score: number;
  raw: unknown;
}

export interface Proposal {
  label: ProposalLabel;
  offerId: string;
  airlineName: string;
  marketingCarriers: string[];
  operatingCarriers: string[];
  totalAmount: number;
  amountText: string;
  currency: string;
  durationMinutes: number;
  maxStops: number;
  departureAt: string;
  finalArrivalAt: string;
  expiresAt: string;
  score: number;
  explanation: string;
}
