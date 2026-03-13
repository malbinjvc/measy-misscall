import { describe, it, expect } from 'vitest';
import {
  computeAppointmentPrice,
  computeItemDuration,
  computeMultiItemPrice,
  computeMultiItemDuration,
  type AppointmentItemForCalc,
} from '@/lib/appointment-helpers';

describe('computeAppointmentPrice', () => {
  it('calculates price with service only (no option)', () => {
    const price = computeAppointmentPrice(
      { quantity: 1, selectedSubOptions: [] },
      { price: 50 },
      null
    );
    expect(price).toBe(50);
  });

  it('multiplies by quantity', () => {
    const price = computeAppointmentPrice(
      { quantity: 3, selectedSubOptions: [] },
      { price: 20 },
      null
    );
    expect(price).toBe(60);
  });

  it('adds option price to service price', () => {
    const price = computeAppointmentPrice(
      { quantity: 1, selectedSubOptions: [] },
      { price: 30 },
      { price: 15, subOptions: [] }
    );
    expect(price).toBe(45);
  });

  it('adds sub-option prices', () => {
    const price = computeAppointmentPrice(
      { quantity: 1, selectedSubOptions: ['sub1', 'sub2'] },
      { price: 50 },
      {
        price: 0,
        subOptions: [
          { id: 'sub1', price: 10 },
          { id: 'sub2', price: 5 },
          { id: 'sub3', price: 100 }, // not selected
        ],
      }
    );
    // 50 * 1 + 10 + 5 = 65
    expect(price).toBe(65);
  });

  it('handles null/undefined prices as zero', () => {
    const price = computeAppointmentPrice(
      { quantity: 2, selectedSubOptions: [] },
      { price: null },
      { price: undefined as unknown as null, subOptions: [] }
    );
    expect(price).toBe(0);
  });

  it('handles Decimal-like values', () => {
    const price = computeAppointmentPrice(
      { quantity: 1, selectedSubOptions: [] },
      { price: 29.99 },
      null
    );
    expect(price).toBeCloseTo(29.99);
  });

  it('quantity applies to base but sub-options are flat', () => {
    const price = computeAppointmentPrice(
      { quantity: 2, selectedSubOptions: ['s1'] },
      { price: 10 },
      { price: 5, subOptions: [{ id: 's1', price: 3 }] }
    );
    // (10 + 5) * 2 + 3 = 33
    expect(price).toBe(33);
  });
});

describe('computeItemDuration', () => {
  it('uses service duration when no option', () => {
    const item: AppointmentItemForCalc = {
      quantity: 1,
      selectedSubOptions: [],
      service: { price: 0, duration: 60 },
      serviceOption: null,
    };
    expect(computeItemDuration(item)).toBe(60);
  });

  it('uses option duration when available', () => {
    const item: AppointmentItemForCalc = {
      quantity: 1,
      selectedSubOptions: [],
      service: { price: 0, duration: 60 },
      serviceOption: { price: 0, duration: 90, subOptions: [] },
    };
    expect(computeItemDuration(item)).toBe(90);
  });

  it('falls back to service duration when option duration is null', () => {
    const item: AppointmentItemForCalc = {
      quantity: 1,
      selectedSubOptions: [],
      service: { price: 0, duration: 45 },
      serviceOption: { price: 0, duration: null, subOptions: [] },
    };
    expect(computeItemDuration(item)).toBe(45);
  });

  it('multiplies duration by quantity', () => {
    const item: AppointmentItemForCalc = {
      quantity: 3,
      selectedSubOptions: [],
      service: { price: 0, duration: 30 },
      serviceOption: null,
    };
    expect(computeItemDuration(item)).toBe(90);
  });
});

describe('computeMultiItemPrice', () => {
  it('sums prices across multiple items', () => {
    const items: AppointmentItemForCalc[] = [
      {
        quantity: 1,
        selectedSubOptions: [],
        service: { price: 50, duration: 60 },
        serviceOption: null,
      },
      {
        quantity: 2,
        selectedSubOptions: [],
        service: { price: 20, duration: 30 },
        serviceOption: { price: 5, subOptions: [] },
      },
    ];
    // item 1: 50 * 1 = 50
    // item 2: (20 + 5) * 2 = 50
    expect(computeMultiItemPrice(items)).toBe(100);
  });

  it('returns 0 for empty array', () => {
    expect(computeMultiItemPrice([])).toBe(0);
  });
});

describe('computeMultiItemDuration', () => {
  it('sums durations across multiple items', () => {
    const items: AppointmentItemForCalc[] = [
      {
        quantity: 1,
        selectedSubOptions: [],
        service: { price: 0, duration: 60 },
        serviceOption: null,
      },
      {
        quantity: 2,
        selectedSubOptions: [],
        service: { price: 0, duration: 30 },
        serviceOption: null,
      },
    ];
    // 60 * 1 + 30 * 2 = 120
    expect(computeMultiItemDuration(items)).toBe(120);
  });

  it('returns 0 for empty array', () => {
    expect(computeMultiItemDuration([])).toBe(0);
  });
});
