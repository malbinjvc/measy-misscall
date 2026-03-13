import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFindUnique, mockMessagesCreate, mockSmsLogCreate } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockMessagesCreate: vi.fn().mockResolvedValue({ sid: 'SM_test' }),
  mockSmsLogCreate: vi.fn().mockResolvedValue({ id: 'log_1' }),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    customer: { findUnique: mockFindUnique },
    smsLog: { create: mockSmsLogCreate },
  },
}));

vi.mock('@/lib/twilio', () => ({
  getTwilioClient: vi.fn().mockResolvedValue({
    messages: { create: mockMessagesCreate },
  }),
}));

vi.mock('@/lib/wallet', () => ({
  chargeForUsage: vi.fn().mockResolvedValue({ charged: false }),
}));

vi.mock('@/lib/utils', () => ({
  normalizePhoneForStorage: (p: string) => p.replace(/\D/g, '').slice(-10),
  getBaseUrl: () => 'https://app.test',
  getShopUrl: (slug: string) => `https://app.test/shop/${slug}`,
}));

import { sendSmsWithConsent } from '@/lib/sms';

const baseParams = {
  tenantId: 'tenant_1',
  to: '+14165551234',
  body: 'Test message',
  type: 'BOOKING_LINK' as const,
};

describe('sendSmsWithConsent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TWILIO_PHONE_NUMBER = '+15555550000';
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.test';
  });

  it('blocks SMS when customer has smsConsent=false', async () => {
    mockFindUnique.mockResolvedValue({ smsConsent: false });

    const result = await sendSmsWithConsent(baseParams);

    expect(result.success).toBe(false);
    expect(result.error).toBe('No SMS consent');
    expect(mockMessagesCreate).not.toHaveBeenCalled();
  });

  it('sends SMS when customer has smsConsent=true', async () => {
    mockFindUnique.mockResolvedValue({ smsConsent: true });

    const result = await sendSmsWithConsent(baseParams);

    expect(result.success).toBe(true);
    expect(mockMessagesCreate).toHaveBeenCalled();
  });

  it('sends SMS when customer is not found (no record = implicit consent)', async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await sendSmsWithConsent(baseParams);

    expect(result.success).toBe(true);
    expect(mockMessagesCreate).toHaveBeenCalled();
  });

  it('sends SMS when smsConsent is null (not explicitly opted out)', async () => {
    mockFindUnique.mockResolvedValue({ smsConsent: null });

    const result = await sendSmsWithConsent(baseParams);

    expect(result.success).toBe(true);
    expect(mockMessagesCreate).toHaveBeenCalled();
  });

  it('normalizes phone number for lookup', async () => {
    mockFindUnique.mockResolvedValue(null);

    await sendSmsWithConsent({ ...baseParams, to: '+1 (416) 555-1234' });

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: {
        tenantId_phone: { tenantId: 'tenant_1', phone: '4165551234' },
      },
      select: { smsConsent: true },
    });
  });
});
