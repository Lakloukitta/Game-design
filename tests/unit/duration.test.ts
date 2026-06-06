import { describe, expect, it } from 'vitest';
import {
  DurationParseError,
  minutesBetween,
  parseIso8601DurationToMinutes,
  tryParseIso8601DurationToMinutes,
} from '@/lib/flights/duration';

describe('parseIso8601DurationToMinutes', () => {
  it('parses PT2H', () => {
    expect(parseIso8601DurationToMinutes('PT2H')).toBe(120);
  });

  it('parses PT2H30M', () => {
    expect(parseIso8601DurationToMinutes('PT2H30M')).toBe(150);
  });

  it('parses P1DT3H5M', () => {
    expect(parseIso8601DurationToMinutes('P1DT3H5M')).toBe(24 * 60 + 185);
  });

  it('parses PT45M', () => {
    expect(parseIso8601DurationToMinutes('PT45M')).toBe(45);
  });

  it('parses seconds by rounding', () => {
    expect(parseIso8601DurationToMinutes('PT90S')).toBe(2);
  });

  it('throws on a malformed value', () => {
    expect(() => parseIso8601DurationToMinutes('2 hours')).toThrow(DurationParseError);
  });

  it('throws on a missing value', () => {
    expect(() => parseIso8601DurationToMinutes(undefined)).toThrow(DurationParseError);
    expect(() => parseIso8601DurationToMinutes('')).toThrow(DurationParseError);
  });

  it('throws on an empty duration (P / PT)', () => {
    expect(() => parseIso8601DurationToMinutes('P')).toThrow(DurationParseError);
    expect(() => parseIso8601DurationToMinutes('PT')).toThrow(DurationParseError);
  });
});

describe('tryParseIso8601DurationToMinutes', () => {
  it('returns null on malformed input instead of throwing', () => {
    expect(tryParseIso8601DurationToMinutes('nope')).toBeNull();
    expect(tryParseIso8601DurationToMinutes('PT3H')).toBe(180);
  });
});

describe('minutesBetween', () => {
  it('computes minutes between two ISO timestamps', () => {
    expect(minutesBetween('2030-01-01T08:00:00Z', '2030-01-01T11:30:00Z')).toBe(210);
  });

  it('throws on invalid timestamps', () => {
    expect(() => minutesBetween('bad', '2030-01-01T11:30:00Z')).toThrow(DurationParseError);
  });
});
