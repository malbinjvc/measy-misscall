import { describe, it, expect } from 'vitest';
import { getErrorMessage } from '@/lib/errors';

describe('getErrorMessage', () => {
  it('extracts message from Error object', () => {
    const err = new Error('something went wrong');
    expect(getErrorMessage(err)).toBe('something went wrong');
  });

  it('returns string directly', () => {
    expect(getErrorMessage('plain error string')).toBe('plain error string');
  });

  it('returns fallback for null', () => {
    expect(getErrorMessage(null)).toBe('An unexpected error occurred');
  });

  it('returns fallback for undefined', () => {
    expect(getErrorMessage(undefined)).toBe('An unexpected error occurred');
  });

  it('returns fallback for number', () => {
    expect(getErrorMessage(42)).toBe('An unexpected error occurred');
  });

  it('returns fallback for object without message', () => {
    expect(getErrorMessage({ code: 500 })).toBe('An unexpected error occurred');
  });
});
