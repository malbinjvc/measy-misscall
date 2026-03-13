import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.mock factories are hoisted — cannot reference outer variables.
// Use vi.hoisted() to create mock functions that work inside factories.
const { mockTxUpdate, mockTxFindUnique, mockTxWalletTxCreate, mockTransaction } = vi.hoisted(() => {
  const mockTxUpdate = vi.fn();
  const mockTxFindUnique = vi.fn();
  const mockTxWalletTxCreate = vi.fn().mockResolvedValue({});
  const mockTransaction = vi.fn();
  return { mockTxUpdate, mockTxFindUnique, mockTxWalletTxCreate, mockTransaction };
});

vi.mock('@/lib/prisma', () => ({
  default: {
    wallet: {
      upsert: vi.fn().mockResolvedValue({ id: 'w1', tenantId: 't1', balance: 10 }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    subscription: {
      findUnique: vi.fn().mockResolvedValue({
        currentPeriodStart: new Date(),
        plan: { maxSms: 100, maxCalls: 50 },
      }),
    },
    $transaction: mockTransaction,
  },
}));

vi.mock('@/lib/stripe', () => ({
  stripe: {
    customers: { retrieve: vi.fn() },
    paymentMethods: { list: vi.fn() },
    paymentIntents: { create: vi.fn() },
  },
}));

vi.mock('@/lib/tax', () => ({
  calculateTotalWithFees: (amount: number) => ({
    subtotal: amount,
    tax: amount * 0.13,
    stripeFee: 0.3,
    total: amount * 1.13 + 0.3,
  }),
}));

import { chargeForUsage, RATE_PER_UNIT } from '@/lib/wallet';

describe('chargeForUsage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Wire up the $transaction mock to call the callback with our mock tx
    mockTransaction.mockImplementation(async (fn: Function) =>
      fn({
        wallet: { update: mockTxUpdate, findUnique: mockTxFindUnique },
        walletTransaction: { create: mockTxWalletTxCreate },
      })
    );
  });

  it('returns withinFreeTier when usage is under limit', async () => {
    mockTxUpdate.mockResolvedValueOnce({ usedSms: 50 }); // 50 <= 100

    const result = await chargeForUsage('t1', 'sms', 1);
    expect(result.withinFreeTier).toBe(true);
    expect(result.charged).toBe(false);
    expect(result.amount).toBe(0);
  });

  it('charges when usage exceeds free tier', async () => {
    // Counter increment → 101 (exceeds 100 limit)
    mockTxUpdate.mockResolvedValueOnce({ usedSms: 101 });
    // Balance check
    mockTxFindUnique.mockResolvedValueOnce({ balance: 10.0 });
    // Balance decrement
    mockTxUpdate.mockResolvedValueOnce({ id: 'w1', balance: 10.0 - RATE_PER_UNIT });

    const result = await chargeForUsage('t1', 'sms', 1);
    expect(result.charged).toBe(true);
    expect(result.amount).toBe(RATE_PER_UNIT);
    expect(result.withinFreeTier).toBe(false);
  });

  it('prevents negative balance (insufficientBalance)', async () => {
    mockTxUpdate.mockResolvedValueOnce({ usedSms: 101 }); // exceeds limit
    mockTxFindUnique.mockResolvedValueOnce({ balance: 0.001 }); // not enough
    mockTxUpdate.mockResolvedValueOnce({ usedSms: 100 }); // counter rollback

    const result = await chargeForUsage('t1', 'sms', 1);
    expect(result.charged).toBe(false);
    expect(result.insufficientBalance).toBe(true);
  });

  it('correctly calculates partial free tier overlap', async () => {
    // 99 used, adding 3 → 102. Limit=100. 1 free, 2 chargeable.
    mockTxUpdate.mockResolvedValueOnce({ usedSms: 102 });
    mockTxFindUnique.mockResolvedValueOnce({ balance: 10.0 });
    mockTxUpdate.mockResolvedValueOnce({ id: 'w1', balance: 10.0 - 2 * RATE_PER_UNIT });

    const result = await chargeForUsage('t1', 'sms', 3);
    expect(result.charged).toBe(true);
    expect(result.amount).toBeCloseTo(2 * RATE_PER_UNIT);
  });

  it('handles call usage type within free tier', async () => {
    mockTxUpdate.mockResolvedValueOnce({ usedCalls: 30 }); // 30 <= 50

    const result = await chargeForUsage('t1', 'call', 1);
    expect(result.withinFreeTier).toBe(true);
  });
});

describe('RATE_PER_UNIT', () => {
  it('is $0.035', () => {
    expect(RATE_PER_UNIT).toBe(0.035);
  });
});
