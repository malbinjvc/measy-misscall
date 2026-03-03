import { describe, it, expect, vi } from 'vitest';

// Mock heavy dependencies that stripe.ts imports at the top level
vi.mock('stripe', () => {
  return {
    default: class StripeMock {
      constructor() {
        // no-op
      }
    },
  };
});

vi.mock('@/lib/prisma', () => {
  return { default: {} };
});

// Mock @prisma/client to provide the SubscriptionStatus enum
vi.mock('@prisma/client', () => {
  return {
    SubscriptionStatus: {
      ACTIVE: 'ACTIVE',
      PAST_DUE: 'PAST_DUE',
      CANCELED: 'CANCELED',
      UNPAID: 'UNPAID',
      TRIALING: 'TRIALING',
      INCOMPLETE: 'INCOMPLETE',
    },
  };
});

import { STRIPE_STATUS_MAP } from '@/lib/stripe';

describe('STRIPE_STATUS_MAP', () => {
  it('maps "active" to "ACTIVE"', () => {
    expect(STRIPE_STATUS_MAP['active']).toBe('ACTIVE');
  });

  it('maps "past_due" to "PAST_DUE"', () => {
    expect(STRIPE_STATUS_MAP['past_due']).toBe('PAST_DUE');
  });

  it('maps "canceled" to "CANCELED"', () => {
    expect(STRIPE_STATUS_MAP['canceled']).toBe('CANCELED');
  });

  it('maps "unpaid" to "UNPAID"', () => {
    expect(STRIPE_STATUS_MAP['unpaid']).toBe('UNPAID');
  });

  it('maps "trialing" to "TRIALING"', () => {
    expect(STRIPE_STATUS_MAP['trialing']).toBe('TRIALING');
  });

  it('maps "incomplete" to "INCOMPLETE"', () => {
    expect(STRIPE_STATUS_MAP['incomplete']).toBe('INCOMPLETE');
  });

  it('returns undefined for unknown status', () => {
    expect(STRIPE_STATUS_MAP['nonexistent']).toBeUndefined();
  });
});
