'use client';

import { useMemo, useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select } from './ui/select';
import { Card } from './ui/card';
import { tripSearchSchema } from '@/lib/validation/trip';
import type { TripSearchInput } from '@/types/domain';

const CABIN_OPTIONS = [
  { value: 'economy', label: 'Economy' },
  { value: 'premium_economy', label: 'Premium economy' },
  { value: 'business', label: 'Business' },
  { value: 'first', label: 'First' },
];

const CONNECTION_OPTIONS = [
  { value: '0', label: 'Nonstop only' },
  { value: '1', label: 'Up to 1 connection' },
  { value: '2', label: 'Up to 2 connections' },
];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function TripSearchForm({
  onSubmit,
  busy,
}: {
  onSubmit: (input: TripSearchInput) => void;
  busy: boolean;
}) {
  const [origin, setOrigin] = useState('LHR');
  const [destination, setDestination] = useState('JFK');
  const [departureDate, setDepartureDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [cabinClass, setCabinClass] = useState('economy');
  const [maxConnections, setMaxConnections] = useState('1');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const today = useMemo(todayIso, []);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const candidate = {
      origin,
      destination,
      departureDate,
      returnDate,
      cabinClass,
      maxConnections: Number(maxConnections),
    };
    const result = tripSearchSchema.safeParse(candidate);
    if (!result.success) {
      const next: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0];
        if (typeof key === 'string' && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    onSubmit({ ...result.data, maxConnections: result.data.maxConnections as 0 | 1 | 2 });
  }

  const errorList = Object.entries(errors);

  return (
    <Card>
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {errorList.length > 0 && (
          <div
            role="alert"
            aria-live="assertive"
            className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"
          >
            <p className="font-semibold">Please fix the following:</p>
            <ul className="ml-4 list-disc">
              {errorList.map(([field, message]) => (
                <li key={field}>{message}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Origin (IATA)"
            value={origin}
            maxLength={3}
            autoCapitalize="characters"
            inputMode="text"
            onChange={(e) => setOrigin(e.target.value.toUpperCase().slice(0, 3))}
            error={errors.origin}
            hint="3-letter airport code, e.g. LHR"
          />
          <Input
            label="Destination (IATA)"
            value={destination}
            maxLength={3}
            onChange={(e) => setDestination(e.target.value.toUpperCase().slice(0, 3))}
            error={errors.destination}
            hint="3-letter airport code, e.g. JFK"
          />
          <Input
            label="Departure date"
            type="date"
            value={departureDate}
            min={today}
            onChange={(e) => setDepartureDate(e.target.value)}
            error={errors.departureDate}
          />
          <Input
            label="Return date"
            type="date"
            value={returnDate}
            min={departureDate || today}
            onChange={(e) => setReturnDate(e.target.value)}
            error={errors.returnDate}
          />
          <Select
            label="Cabin class"
            options={CABIN_OPTIONS}
            value={cabinClass}
            onChange={(e) => setCabinClass(e.target.value)}
            error={errors.cabinClass}
          />
          <Select
            label="Maximum connections"
            options={CONNECTION_OPTIONS}
            value={maxConnections}
            onChange={(e) => setMaxConnections(e.target.value)}
            error={errors.maxConnections}
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-ink-muted">One adult traveler · round trip</p>
          <Button type="submit" loading={busy}>
            {busy ? 'Searching live airline test inventory…' : 'Search live test flights'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
