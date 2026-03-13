import { describe, it, expect, beforeAll } from 'vitest';
import { signCustomerToken, verifyCustomerToken } from '@/lib/customer-auth';

beforeAll(() => {
  process.env.CUSTOMER_JWT_SECRET = 'test-jwt-secret-for-vitest';
});

const validPayload = {
  customerId: 'cust_123',
  tenantId: 'tenant_456',
  phone: '+14165551234',
};

describe('signCustomerToken / verifyCustomerToken', () => {
  it('round-trips a valid payload', async () => {
    const token = await signCustomerToken(validPayload);
    const decoded = await verifyCustomerToken(token);
    expect(decoded).toMatchObject(validPayload);
  });

  it('returns null for a garbage token', async () => {
    const result = await verifyCustomerToken('not.a.jwt');
    expect(result).toBeNull();
  });

  it('returns null for an empty string', async () => {
    const result = await verifyCustomerToken('');
    expect(result).toBeNull();
  });

  it('returns null for a tampered token', async () => {
    const token = await signCustomerToken(validPayload);
    // Flip last character
    const tampered = token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A');
    const result = await verifyCustomerToken(tampered);
    expect(result).toBeNull();
  });

  it('produces different tokens each time (iat differs)', async () => {
    const t1 = await signCustomerToken(validPayload);
    // Small delay to ensure different iat
    await new Promise((r) => setTimeout(r, 1100));
    const t2 = await signCustomerToken(validPayload);
    expect(t1).not.toBe(t2);
    // Both should still be valid
    expect(await verifyCustomerToken(t1)).toMatchObject(validPayload);
    expect(await verifyCustomerToken(t2)).toMatchObject(validPayload);
  });

  it('preserves all payload fields', async () => {
    const token = await signCustomerToken(validPayload);
    const decoded = await verifyCustomerToken(token);
    expect(decoded?.customerId).toBe(validPayload.customerId);
    expect(decoded?.tenantId).toBe(validPayload.tenantId);
    expect(decoded?.phone).toBe(validPayload.phone);
  });
});
