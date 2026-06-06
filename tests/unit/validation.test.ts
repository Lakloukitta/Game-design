import { describe, expect, it } from 'vitest';
import { tripSearchSchema } from '@/lib/validation/trip';
import { passengerSchema, ageInYears } from '@/lib/validation/passenger';

const futureDeparture = '2032-05-01';
const futureReturn = '2032-05-08';

const validTrip = {
  origin: 'lhr',
  destination: 'jfk',
  departureDate: futureDeparture,
  returnDate: futureReturn,
  cabinClass: 'economy',
  maxConnections: 1,
};

describe('tripSearchSchema', () => {
  it('accepts a valid request and uppercases codes', () => {
    const parsed = tripSearchSchema.parse(validTrip);
    expect(parsed.origin).toBe('LHR');
    expect(parsed.destination).toBe('JFK');
  });

  it('rejects an invalid IATA code', () => {
    const result = tripSearchSchema.safeParse({ ...validTrip, origin: 'LH' });
    expect(result.success).toBe(false);
  });

  it('rejects identical origin and destination', () => {
    const result = tripSearchSchema.safeParse({ ...validTrip, destination: 'LHR' });
    expect(result.success).toBe(false);
  });

  it('rejects a return date before departure', () => {
    const result = tripSearchSchema.safeParse({
      ...validTrip,
      returnDate: '2032-04-30',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a past departure date', () => {
    const result = tripSearchSchema.safeParse({ ...validTrip, departureDate: '2000-01-01' });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid cabin class', () => {
    const result = tripSearchSchema.safeParse({ ...validTrip, cabinClass: 'luxury' });
    expect(result.success).toBe(false);
  });

  it('rejects connection counts outside 0..2', () => {
    expect(tripSearchSchema.safeParse({ ...validTrip, maxConnections: 3 }).success).toBe(false);
    expect(tripSearchSchema.safeParse({ ...validTrip, maxConnections: -1 }).success).toBe(false);
  });

  it('rejects unknown fields', () => {
    const result = tripSearchSchema.safeParse({ ...validTrip, sneaky: true });
    expect(result.success).toBe(false);
  });
});

const validPassenger = {
  title: 'mr',
  gender: 'm',
  givenName: 'Test',
  familyName: 'Traveller',
  bornOn: '1990-01-01',
  email: 'test@example.com',
  phoneNumber: '+14155550123',
};

describe('passengerSchema', () => {
  it('accepts a valid passenger and normalizes the phone number', () => {
    const parsed = passengerSchema.parse({ ...validPassenger, phoneNumber: '+1 (415) 555-0123' });
    expect(parsed.phoneNumber).toBe('+14155550123');
  });

  it('rejects an invalid email', () => {
    expect(passengerSchema.safeParse({ ...validPassenger, email: 'nope' }).success).toBe(false);
  });

  it('rejects a non-E.164 phone number', () => {
    expect(
      passengerSchema.safeParse({ ...validPassenger, phoneNumber: '4155550123' }).success,
    ).toBe(false);
  });

  it('rejects blank names', () => {
    expect(passengerSchema.safeParse({ ...validPassenger, givenName: '' }).success).toBe(false);
  });

  it('rejects names with digits', () => {
    expect(passengerSchema.safeParse({ ...validPassenger, familyName: 'A1b2' }).success).toBe(
      false,
    );
  });
});

describe('ageInYears', () => {
  it('computes whole years and flags an underage passenger', () => {
    expect(ageInYears('2000-01-01', '2018-01-01')).toBe(18);
    expect(ageInYears('2020-06-01', futureDeparture)).toBeLessThan(18);
  });
});
