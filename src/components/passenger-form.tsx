'use client';

import { useState } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select } from './ui/select';
import { Alert } from './ui/alert';
import { passengerSchema, ageInYears, ADULT_MIN_YEARS } from '@/lib/validation/passenger';
import type { PassengerInput } from '@/types/domain';

const TITLE_OPTIONS = [
  { value: 'mr', label: 'Mr' },
  { value: 'mrs', label: 'Mrs' },
  { value: 'ms', label: 'Ms' },
  { value: 'miss', label: 'Miss' },
  { value: 'dr', label: 'Dr' },
];

const GENDER_OPTIONS = [
  { value: 'm', label: 'Male' },
  { value: 'f', label: 'Female' },
];

export function PassengerForm({
  departureDate,
  busy,
  onSubmit,
}: {
  departureDate: string;
  busy: boolean;
  onSubmit: (passenger: PassengerInput) => void;
}) {
  const [values, setValues] = useState({
    title: 'mr',
    gender: 'm',
    givenName: '',
    familyName: '',
    bornOn: '',
    email: '',
    phoneNumber: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function set<K extends keyof typeof values>(key: K, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const result = passengerSchema.safeParse(values);
    const next: Record<string, string> = {};
    if (!result.success) {
      for (const issue of result.error.issues) {
        const key = issue.path[0];
        if (typeof key === 'string' && !next[key]) next[key] = issue.message;
      }
    } else if (departureDate && ageInYears(result.data.bornOn, departureDate) < ADULT_MIN_YEARS) {
      next.bornOn = `Passenger must be at least ${ADULT_MIN_YEARS} on the departure date.`;
    }
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }
    setErrors({});
    onSubmit(result.data!);
  }

  return (
    <Card className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-ink">Passenger details</h2>
        <Alert tone="info" title="Use synthetic test details only.">
          This is a sandbox. Do not enter real personal data. We never store passenger details or
          collect cards or passports.
        </Alert>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label="Title"
            options={TITLE_OPTIONS}
            value={values.title}
            onChange={(e) => set('title', e.target.value)}
            error={errors.title}
          />
          <Select
            label="Gender"
            options={GENDER_OPTIONS}
            value={values.gender}
            onChange={(e) => set('gender', e.target.value)}
            error={errors.gender}
          />
          <Input
            label="Given name"
            value={values.givenName}
            onChange={(e) => set('givenName', e.target.value)}
            error={errors.givenName}
            autoComplete="off"
          />
          <Input
            label="Family name"
            value={values.familyName}
            onChange={(e) => set('familyName', e.target.value)}
            error={errors.familyName}
            autoComplete="off"
          />
          <Input
            label="Date of birth"
            type="date"
            value={values.bornOn}
            onChange={(e) => set('bornOn', e.target.value)}
            error={errors.bornOn}
          />
          <Input
            label="Email"
            type="email"
            value={values.email}
            onChange={(e) => set('email', e.target.value)}
            error={errors.email}
            placeholder="test@example.com"
            autoComplete="off"
          />
          <Input
            label="International phone"
            value={values.phoneNumber}
            onChange={(e) => set('phoneNumber', e.target.value)}
            error={errors.phoneNumber}
            placeholder="+14155550123"
            hint="E.164 format, starting with +"
            autoComplete="off"
          />
        </div>

        <Button type="submit" loading={busy} className="w-full sm:w-auto">
          {busy ? 'Creating your sandbox reservation…' : 'Create sandbox reservation'}
        </Button>
      </form>
    </Card>
  );
}
