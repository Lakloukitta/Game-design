/**
 * Deterministic mock supplier fixtures for local development and tests. These
 * are clearly-labelled local inventory — never presented as live data. Offer
 * IDs are stable so behavior is reproducible:
 *
 *   off_mock_best        normal bookable, confirms on order
 *   off_mock_cheap       lowest price, longest, 2 stops
 *   off_mock_fast        nonstop, shortest, highest price
 *   off_mock_balanced    mid-tier alternative
 *   off_mock_pricechange revalidation/booking returns a higher price
 *   off_mock_expired     already expired
 *   off_mock_docs        requires identity documents
 *   off_mock_pending     order creation returns supplier-pending
 *   off_mock_fail        order creation fails
 */
import type { SearchInput, SupplierOffer } from '@/lib/duffel/types';

export const MOCK_CURRENCY = 'GBP';

export interface MockOfferSpec {
  id: string;
  amount: string;
  outboundSegments: number;
  returnSegments: number;
  outboundDurationMin: number;
  returnDurationMin: number;
  expiresInMinutes: number;
  identityDocumentsRequired?: boolean;
  /** Distinct operating carrier to exercise "Operated by" display. */
  operatedByCodeshare?: boolean;
}

export const MOCK_OFFER_SPECS: MockOfferSpec[] = [
  {
    id: 'off_mock_best',
    amount: '462.30',
    outboundSegments: 2,
    returnSegments: 1,
    outboundDurationMin: 510,
    returnDurationMin: 470,
    expiresInMinutes: 30,
  },
  {
    id: 'off_mock_cheap',
    amount: '389.99',
    outboundSegments: 3,
    returnSegments: 3,
    outboundDurationMin: 690,
    returnDurationMin: 720,
    expiresInMinutes: 30,
    operatedByCodeshare: true,
  },
  {
    id: 'off_mock_fast',
    amount: '658.00',
    outboundSegments: 1,
    returnSegments: 1,
    outboundDurationMin: 425,
    returnDurationMin: 445,
    expiresInMinutes: 30,
  },
  {
    id: 'off_mock_balanced',
    amount: '511.50',
    outboundSegments: 2,
    returnSegments: 2,
    outboundDurationMin: 545,
    returnDurationMin: 560,
    expiresInMinutes: 30,
  },
  {
    id: 'off_mock_pricechange',
    amount: '430.00',
    outboundSegments: 2,
    returnSegments: 2,
    outboundDurationMin: 530,
    returnDurationMin: 540,
    expiresInMinutes: 30,
  },
  {
    id: 'off_mock_expired',
    amount: '405.10',
    outboundSegments: 2,
    returnSegments: 2,
    outboundDurationMin: 600,
    returnDurationMin: 600,
    expiresInMinutes: -5,
  },
  {
    id: 'off_mock_docs',
    amount: '479.20',
    outboundSegments: 1,
    returnSegments: 2,
    outboundDurationMin: 450,
    returnDurationMin: 520,
    expiresInMinutes: 30,
    identityDocumentsRequired: true,
  },
  {
    id: 'off_mock_pending',
    amount: '498.75',
    outboundSegments: 2,
    returnSegments: 1,
    outboundDurationMin: 505,
    returnDurationMin: 480,
    expiresInMinutes: 30,
  },
  {
    id: 'off_mock_fail',
    amount: '521.40',
    outboundSegments: 2,
    returnSegments: 2,
    outboundDurationMin: 560,
    returnDurationMin: 575,
    expiresInMinutes: 30,
  },
];

const MARKETING = { name: 'Duffel Airways', iata_code: 'ZZ' };
const OPERATING_MAIN = { name: 'Duffel Airways', iata_code: 'ZZ' };
const OPERATING_CODESHARE = { name: 'Duffel Regional', iata_code: 'ZR' };

function isoAt(date: string, hours: number, minutes: number): string {
  const h = String(hours).padStart(2, '0');
  const m = String(minutes).padStart(2, '0');
  return `${date}T${h}:${m}:00Z`;
}

function buildSlice(
  origin: string,
  destination: string,
  date: string,
  segmentCount: number,
  totalDurationMin: number,
  operating: { name: string; iata_code: string },
): SupplierOffer['slices'][number] {
  const segments = [];
  const perSegment = Math.floor(totalDurationMin / segmentCount);
  let cursorMinutes = 8 * 60; // first departure at 08:00
  for (let i = 0; i < segmentCount; i++) {
    const depMin = cursorMinutes;
    const arrMin = depMin + perSegment;
    segments.push({
      departing_at: isoAt(date, Math.floor(depMin / 60) % 24, depMin % 60),
      arriving_at: isoAt(date, Math.floor(arrMin / 60) % 24, arrMin % 60),
      duration: `PT${Math.floor(perSegment / 60)}H${perSegment % 60}M`,
      marketing_carrier: MARKETING,
      operating_carrier: i === 0 ? operating : OPERATING_MAIN,
    });
    cursorMinutes = arrMin + 75; // 75-minute layover
  }
  void origin;
  void destination;
  return {
    duration: `PT${Math.floor(totalDurationMin / 60)}H${totalDurationMin % 60}M`,
    segments,
  };
}

export function buildMockOffer(
  spec: MockOfferSpec,
  input: Pick<SearchInput, 'origin' | 'destination' | 'departureDate' | 'returnDate'>,
  now: number = Date.now(),
): SupplierOffer {
  const operating = spec.operatedByCodeshare ? OPERATING_CODESHARE : OPERATING_MAIN;
  return {
    id: spec.id,
    total_amount: spec.amount,
    total_currency: MOCK_CURRENCY,
    expires_at: new Date(now + spec.expiresInMinutes * 60_000).toISOString(),
    passenger_identity_documents_required: Boolean(spec.identityDocumentsRequired),
    owner: MARKETING,
    passengers: [{ id: `pas_mock_${spec.id}`, type: 'adult' }],
    slices: [
      buildSlice(
        input.origin,
        input.destination,
        input.departureDate,
        spec.outboundSegments,
        spec.outboundDurationMin,
        operating,
      ),
      buildSlice(
        input.destination,
        input.origin,
        input.returnDate,
        spec.returnSegments,
        spec.returnDurationMin,
        operating,
      ),
    ],
  };
}

export function buildMockOffers(input: SearchInput, now: number = Date.now()): SupplierOffer[] {
  return MOCK_OFFER_SPECS.map((spec) => buildMockOffer(spec, input, now));
}

/** Default search context used when an offer is fetched without a prior search. */
export const DEFAULT_MOCK_CONTEXT = {
  origin: 'LHR',
  destination: 'JFK',
  departureDate: '2030-01-10',
  returnDate: '2030-01-17',
};
