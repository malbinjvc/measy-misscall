import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFindUnique } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
}));

vi.mock('@/lib/prisma-read', () => ({
  default: {
    subscription: { findUnique: mockFindUnique },
  },
}));

import { hasFeature, getTenantFeatures, featureGatedResponse } from '@/lib/feature-gate';

describe('hasFeature', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns true when plan includes the feature', async () => {
    mockFindUnique.mockResolvedValue({
      plan: { features: ['missed_call_ivr', 'appointment_sms', 'campaigns'] },
    });

    expect(await hasFeature('t1', 'campaigns')).toBe(true);
  });

  it('returns false when plan does not include the feature', async () => {
    mockFindUnique.mockResolvedValue({
      plan: { features: ['missed_call_ivr'] },
    });

    expect(await hasFeature('t1', 'campaigns')).toBe(false);
  });

  it('returns false when no subscription exists', async () => {
    mockFindUnique.mockResolvedValue(null);

    expect(await hasFeature('t1', 'missed_call_ivr')).toBe(false);
  });

  it('returns false when subscription exists but plan is null', async () => {
    mockFindUnique.mockResolvedValue({ plan: null });

    expect(await hasFeature('t1', 'missed_call_ivr')).toBe(false);
  });

  it('returns false for empty features array', async () => {
    mockFindUnique.mockResolvedValue({ plan: { features: [] } });

    expect(await hasFeature('t1', 'ai_chat')).toBe(false);
  });
});

describe('getTenantFeatures', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns all features for a subscribed tenant', async () => {
    const features = ['missed_call_ivr', 'appointment_sms'];
    mockFindUnique.mockResolvedValue({ plan: { features } });

    expect(await getTenantFeatures('t1')).toEqual(features);
  });

  it('returns empty array when no subscription', async () => {
    mockFindUnique.mockResolvedValue(null);

    expect(await getTenantFeatures('t1')).toEqual([]);
  });

  it('returns empty array when plan has no features', async () => {
    mockFindUnique.mockResolvedValue({ plan: { features: [] } });

    expect(await getTenantFeatures('t1')).toEqual([]);
  });
});

describe('featureGatedResponse', () => {
  it('returns correct error structure', () => {
    const resp = featureGatedResponse('AI Chat');
    expect(resp.success).toBe(false);
    expect(resp.code).toBe('FEATURE_GATED');
    expect(resp.error).toContain('AI Chat');
    expect(resp.error).toContain('upgrade');
  });
});
