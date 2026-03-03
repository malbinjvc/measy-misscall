import { describe, it, expect } from 'vitest';
import {
  normalizePhoneNumber,
  generateSlug,
  timeStringToMinutes,
  generateTimeSlots,
  formatCurrency,
} from '@/lib/utils';

describe('normalizePhoneNumber', () => {
  it('returns null for null input', () => {
    expect(normalizePhoneNumber(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(normalizePhoneNumber(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(normalizePhoneNumber('')).toBeNull();
  });

  it('strips formatting characters', () => {
    expect(normalizePhoneNumber('(123) 456-7890')).toBe('1234567890');
  });

  it('preserves leading + for international format', () => {
    expect(normalizePhoneNumber('+1 (365) 654-3756')).toBe('+13656543756');
  });

  it('strips spaces and dashes', () => {
    expect(normalizePhoneNumber('123-456-7890')).toBe('1234567890');
  });

  it('handles already clean number', () => {
    expect(normalizePhoneNumber('+11234567890')).toBe('+11234567890');
  });
});

describe('generateSlug', () => {
  it('converts to lowercase', () => {
    expect(generateSlug('Hello World')).toBe('hello-world');
  });

  it('replaces non-alphanumeric characters with hyphens', () => {
    expect(generateSlug("Bob's Barber Shop!")).toBe('bob-s-barber-shop');
  });

  it('removes leading and trailing hyphens', () => {
    expect(generateSlug('--test--')).toBe('test');
  });

  it('collapses multiple special chars into single hyphen', () => {
    expect(generateSlug('foo   bar')).toBe('foo-bar');
  });

  it('handles numbers', () => {
    expect(generateSlug('Shop 123')).toBe('shop-123');
  });
});

describe('timeStringToMinutes', () => {
  it('converts "00:00" to 0', () => {
    expect(timeStringToMinutes('00:00')).toBe(0);
  });

  it('converts "09:30" to 570', () => {
    expect(timeStringToMinutes('09:30')).toBe(570);
  });

  it('converts "12:00" to 720', () => {
    expect(timeStringToMinutes('12:00')).toBe(720);
  });

  it('converts "23:59" to 1439', () => {
    expect(timeStringToMinutes('23:59')).toBe(1439);
  });
});

describe('generateTimeSlots', () => {
  it('generates 30-minute slots by default', () => {
    const slots = generateTimeSlots('09:00', '11:00');
    expect(slots).toEqual(['09:00', '09:30', '10:00', '10:30']);
  });

  it('generates 60-minute slots', () => {
    const slots = generateTimeSlots('09:00', '12:00', 60);
    expect(slots).toEqual(['09:00', '10:00', '11:00']);
  });

  it('generates 15-minute slots', () => {
    const slots = generateTimeSlots('09:00', '10:00', 15);
    expect(slots).toEqual(['09:00', '09:15', '09:30', '09:45']);
  });

  it('returns empty array when start equals end', () => {
    const slots = generateTimeSlots('09:00', '09:00');
    expect(slots).toEqual([]);
  });

  it('does not include end time as a slot', () => {
    const slots = generateTimeSlots('09:00', '10:00', 30);
    expect(slots).toEqual(['09:00', '09:30']);
    expect(slots).not.toContain('10:00');
  });
});

describe('formatCurrency', () => {
  it('formats whole dollar amount', () => {
    expect(formatCurrency(100)).toBe('$100.00');
  });

  it('formats amount with cents', () => {
    expect(formatCurrency(49.99)).toBe('$49.99');
  });

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });

  it('formats thousands with comma', () => {
    expect(formatCurrency(1234.56)).toBe('$1,234.56');
  });
});
