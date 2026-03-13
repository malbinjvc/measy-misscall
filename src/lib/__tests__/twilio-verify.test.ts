import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockValidateRequest } = vi.hoisted(() => ({
  mockValidateRequest: vi.fn(),
}));

vi.mock('twilio', () => {
  const fn = Object.assign(
    vi.fn(() => ({})),
    { validateRequest: mockValidateRequest }
  );
  return { default: fn };
});

vi.mock('@/lib/prisma', () => ({
  default: {
    platformSettings: {
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
    },
  },
}));

vi.mock('@/lib/crypto', () => ({
  decrypt: vi.fn((v: string) => v),
  isEncrypted: vi.fn(() => false),
}));

import { validateTwilioSignature } from '@/lib/twilio';

describe('validateTwilioSignature', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TWILIO_ACCOUNT_SID = 'AC_test_sid';
    process.env.TWILIO_AUTH_TOKEN = 'test_auth_token';
  });

  it('returns true for a valid signature', async () => {
    mockValidateRequest.mockReturnValue(true);

    const result = await validateTwilioSignature(
      'valid-sig-header',
      'https://example.com/api/twilio/voice',
      { CallSid: 'CA123', From: '+14165551234' }
    );

    expect(result).toBe(true);
    expect(mockValidateRequest).toHaveBeenCalledWith(
      'test_auth_token',
      'valid-sig-header',
      'https://example.com/api/twilio/voice',
      { CallSid: 'CA123', From: '+14165551234' }
    );
  });

  it('returns false for an invalid signature', async () => {
    mockValidateRequest.mockReturnValue(false);

    const result = await validateTwilioSignature(
      'bad-sig',
      'https://example.com/api/twilio/voice',
      { CallSid: 'CA123' }
    );

    expect(result).toBe(false);
  });

  it('passes the auth token from env to validateRequest', async () => {
    mockValidateRequest.mockReturnValue(true);

    await validateTwilioSignature('sig', 'https://url.com', {});

    // Token comes from env: TWILIO_AUTH_TOKEN = 'test_auth_token'
    expect(mockValidateRequest).toHaveBeenCalledWith(
      'test_auth_token',
      'sig',
      'https://url.com',
      {}
    );
  });

  it('passes params correctly to validateRequest', async () => {
    mockValidateRequest.mockReturnValue(true);
    const params = { From: '+1234', To: '+5678', Body: 'hello' };

    await validateTwilioSignature('sig', 'https://url.com/sms', params);

    expect(mockValidateRequest).toHaveBeenCalledWith(
      expect.any(String),
      'sig',
      'https://url.com/sms',
      params
    );
  });
});
