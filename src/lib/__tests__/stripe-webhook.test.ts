import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockConstructEvent, mockUpdateMany, mockFindFirst, mockQueryRaw } = vi.hoisted(() => ({
  mockConstructEvent: vi.fn(),
  mockUpdateMany: vi.fn().mockResolvedValue({ count: 1 }),
  mockFindFirst: vi.fn(),
  mockQueryRaw: vi.fn().mockResolvedValue([{ count: 0 }]),
}));

vi.mock('@/lib/stripe', () => ({
  stripe: {
    webhooks: { constructEvent: (...args: unknown[]) => mockConstructEvent(...args) },
  },
  upsertSubscriptionFromStripe: vi.fn().mockResolvedValue({}),
  STRIPE_STATUS_MAP: {
    active: 'ACTIVE',
    past_due: 'PAST_DUE',
    canceled: 'CANCELED',
    unpaid: 'UNPAID',
  },
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    tenant: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    subscription: {
      updateMany: mockUpdateMany,
      findFirst: mockFindFirst,
    },
    $queryRaw: mockQueryRaw,
  },
}));

vi.mock('@/lib/errors', () => ({
  getErrorMessage: (e: unknown) => String(e),
}));

vi.mock('@/lib/admin-log', () => ({
  logAdminAction: vi.fn().mockResolvedValue({}),
}));

import { POST } from '@/app/api/stripe/webhook/route';

function makeRequest(body: string, signature: string | null): NextRequest {
  const headers = new Headers({ 'content-type': 'text/plain' });
  if (signature) headers.set('stripe-signature', signature);
  return new NextRequest('http://localhost/api/stripe/webhook', {
    method: 'POST',
    body,
    headers,
  });
}

describe('Stripe Webhook POST', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
  });

  it('returns 400 when stripe-signature header is missing', async () => {
    const res = await POST(makeRequest('{}', null));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('No signature');
  });

  it('returns 400 when signature verification fails', async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error('Signature mismatch');
    });

    const res = await POST(makeRequest('{}', 'bad_sig'));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Invalid signature');
  });

  it('handles checkout.session.completed', async () => {
    mockConstructEvent.mockReturnValue({
      id: 'evt_1',
      type: 'checkout.session.completed',
      data: {
        object: {
          metadata: { tenantId: 'tenant_1' },
          subscription: 'sub_123',
        },
      },
    });

    const res = await POST(makeRequest('{}', 'valid_sig'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
  });

  it('handles invoice.paid — sets status to ACTIVE', async () => {
    mockConstructEvent.mockReturnValue({
      id: 'evt_2',
      type: 'invoice.paid',
      data: { object: { subscription: 'sub_456' } },
    });

    const res = await POST(makeRequest('{}', 'valid_sig'));
    expect(res.status).toBe(200);
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { stripeSubscriptionId: 'sub_456' },
        data: { status: 'ACTIVE' },
      })
    );
  });

  it('handles invoice.payment_failed — sets status to PAST_DUE', async () => {
    mockConstructEvent.mockReturnValue({
      id: 'evt_3',
      type: 'invoice.payment_failed',
      data: { object: { subscription: 'sub_789' } },
    });

    const res = await POST(makeRequest('{}', 'valid_sig'));
    expect(res.status).toBe(200);
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'PAST_DUE' },
      })
    );
  });

  it('handles customer.subscription.deleted — sets status to CANCELED', async () => {
    mockFindFirst.mockResolvedValue({
      tenantId: 'tenant_1',
      tenant: { name: 'Test Shop' },
    });

    mockConstructEvent.mockReturnValue({
      id: 'evt_4',
      type: 'customer.subscription.deleted',
      data: { object: { id: 'sub_del' } },
    });

    const res = await POST(makeRequest('{}', 'valid_sig'));
    expect(res.status).toBe(200);
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'CANCELED' },
      })
    );
  });

  it('handles subscription.updated with cancel_at_period_end', async () => {
    mockFindFirst.mockResolvedValue({
      tenantId: 'tenant_1',
      tenant: { name: 'Test Shop' },
    });

    mockConstructEvent.mockReturnValue({
      id: 'evt_5',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_upd',
          status: 'active',
          cancel_at_period_end: true,
          current_period_start: 1700000000,
          current_period_end: 1702592000,
        },
      },
    });

    const res = await POST(makeRequest('{}', 'valid_sig'));
    expect(res.status).toBe(200);
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'ACTIVE',
          cancelAtPeriodEnd: true,
        }),
      })
    );
  });

  it('returns 200 for unhandled event types', async () => {
    mockConstructEvent.mockReturnValue({
      id: 'evt_6',
      type: 'payment_intent.created',
      data: { object: {} },
    });

    const res = await POST(makeRequest('{}', 'valid_sig'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
  });
});
