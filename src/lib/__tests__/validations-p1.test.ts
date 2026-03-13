import { describe, it, expect } from 'vitest';
import {
  loginSchema,
  businessProfileSchema,
  serviceSchema,
  createServiceSchema,
  serviceOptionSchema,
  businessHoursSchema,
  createPlanSchema,
  platformSettingsSchema,
  createTicketSchema,
  ticketMessageSchema,
  updateTicketStatusSchema,
  reviewSchema,
  phoneVerificationSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  importedReviewSchema,
  reviewImportPayloadSchema,
  deleteByIdSchema,
  updateCallSchema,
  sendOtpSchema,
  verifyOtpSchema,
  chatMessageSchema,
  checkoutSchema,
  updateCustomerSchema,
  createCampaignSchema,
  inviteStaffSchema,
  acceptInviteSchema,
  updateAppointmentSchema,
} from '@/lib/validations';

// ─── loginSchema ─────────────────────────────────────
describe('loginSchema', () => {
  it('accepts valid login', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: '123456' }).success).toBe(true);
  });
  it('rejects short password', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: '12345' }).success).toBe(false);
  });
  it('rejects invalid email', () => {
    expect(loginSchema.safeParse({ email: 'bad', password: '123456' }).success).toBe(false);
  });
});

// ─── businessProfileSchema ───────────────────────────
describe('businessProfileSchema', () => {
  const valid = {
    name: 'My Shop', slug: 'my-shop', email: 'a@b.com', businessPhoneNumber: '4165551234',
  };
  it('accepts valid profile', () => {
    expect(businessProfileSchema.safeParse(valid).success).toBe(true);
  });
  it('rejects uppercase slug', () => {
    expect(businessProfileSchema.safeParse({ ...valid, slug: 'My-Shop' }).success).toBe(false);
  });
  it('rejects slug with spaces', () => {
    expect(businessProfileSchema.safeParse({ ...valid, slug: 'my shop' }).success).toBe(false);
  });
  it('accepts optional URL fields as empty string', () => {
    expect(businessProfileSchema.safeParse({ ...valid, facebookUrl: '' }).success).toBe(true);
  });
  it('rejects invalid URL', () => {
    expect(businessProfileSchema.safeParse({ ...valid, facebookUrl: 'not-url' }).success).toBe(false);
  });
  it('accepts maxConcurrentBookings in range', () => {
    expect(businessProfileSchema.safeParse({ ...valid, maxConcurrentBookings: 10 }).success).toBe(true);
  });
  it('rejects maxConcurrentBookings > 50', () => {
    expect(businessProfileSchema.safeParse({ ...valid, maxConcurrentBookings: 51 }).success).toBe(false);
  });
});

// ─── serviceSchema ───────────────────────────────────
describe('serviceSchema', () => {
  it('accepts valid service', () => {
    expect(serviceSchema.safeParse({ name: 'Haircut', duration: 30 }).success).toBe(true);
  });
  it('rejects duration < 15', () => {
    expect(serviceSchema.safeParse({ name: 'Quick', duration: 10 }).success).toBe(false);
  });
  it('rejects duration > 480', () => {
    expect(serviceSchema.safeParse({ name: 'Long', duration: 500 }).success).toBe(false);
  });
});

// ─── createServiceSchema ─────────────────────────────
describe('createServiceSchema', () => {
  it('accepts service with options', () => {
    const result = createServiceSchema.safeParse({
      name: 'Oil Change',
      duration: 60,
      options: [{ name: 'Synthetic', sortOrder: 0, defaultQuantity: 1, minQuantity: 1, maxQuantity: 10 }],
    });
    expect(result.success).toBe(true);
  });
});

// ─── serviceOptionSchema ─────────────────────────────
describe('serviceOptionSchema', () => {
  it('accepts valid option', () => {
    const result = serviceOptionSchema.safeParse({
      name: 'Premium', sortOrder: 0, defaultQuantity: 1, minQuantity: 1, maxQuantity: 5,
    });
    expect(result.success).toBe(true);
  });
  it('rejects empty name', () => {
    expect(serviceOptionSchema.safeParse({ name: '' }).success).toBe(false);
  });
});

// ─── businessHoursSchema ─────────────────────────────
describe('businessHoursSchema', () => {
  it('accepts valid hours', () => {
    const result = businessHoursSchema.safeParse({
      hours: [{ day: 'MONDAY', isOpen: true, openTime: '09:00', closeTime: '17:00' }],
    });
    expect(result.success).toBe(true);
  });
  it('rejects invalid time format', () => {
    const result = businessHoursSchema.safeParse({
      hours: [{ day: 'MONDAY', isOpen: true, openTime: '9am', closeTime: '5pm' }],
    });
    expect(result.success).toBe(false);
  });
  it('rejects invalid day', () => {
    const result = businessHoursSchema.safeParse({
      hours: [{ day: 'FUNDAY', isOpen: true, openTime: '09:00', closeTime: '17:00' }],
    });
    expect(result.success).toBe(false);
  });
});

// ─── createPlanSchema ────────────────────────────────
describe('createPlanSchema', () => {
  const valid = { name: 'Pro', price: 49, interval: 'month', maxCalls: 100, maxSms: 200, maxServices: 10, maxStaff: 5 };
  it('accepts valid plan', () => {
    expect(createPlanSchema.safeParse(valid).success).toBe(true);
  });
  it('rejects negative price', () => {
    expect(createPlanSchema.safeParse({ ...valid, price: -1 }).success).toBe(false);
  });
  it('rejects invalid interval', () => {
    expect(createPlanSchema.safeParse({ ...valid, interval: 'weekly' }).success).toBe(false);
  });
});

// ─── platformSettingsSchema ──────────────────────────
describe('platformSettingsSchema', () => {
  it('accepts empty object (all optional)', () => {
    expect(platformSettingsSchema.safeParse({}).success).toBe(true);
  });
  it('accepts valid banner settings', () => {
    expect(platformSettingsSchema.safeParse({
      dashboardBannerEnabled: true,
      dashboardBannerType: 'image',
      dashboardBannerLink: 'https://example.com',
    }).success).toBe(true);
  });
  it('rejects invalid banner type', () => {
    expect(platformSettingsSchema.safeParse({ dashboardBannerType: 'gif' }).success).toBe(false);
  });
});

// ─── Support schemas ─────────────────────────────────
describe('createTicketSchema', () => {
  it('accepts valid ticket', () => {
    expect(createTicketSchema.safeParse({ subject: 'Help me', message: 'I need help with something' }).success).toBe(true);
  });
  it('rejects short subject', () => {
    expect(createTicketSchema.safeParse({ subject: 'Hi', message: 'I need help with something' }).success).toBe(false);
  });
  it('rejects short message', () => {
    expect(createTicketSchema.safeParse({ subject: 'Help me', message: 'short' }).success).toBe(false);
  });
});

describe('ticketMessageSchema', () => {
  it('accepts message with text', () => {
    expect(ticketMessageSchema.safeParse({ message: 'Hello there!' }).success).toBe(true);
  });
  it('accepts message with attachment only', () => {
    expect(ticketMessageSchema.safeParse({ message: '', attachmentUrls: ['https://f.co/a.png'], attachmentNames: ['a.png'] }).success).toBe(true);
  });
  it('rejects empty message without attachment', () => {
    expect(ticketMessageSchema.safeParse({ message: '  ' }).success).toBe(false);
  });
});

describe('updateTicketStatusSchema', () => {
  it('accepts valid status', () => {
    expect(updateTicketStatusSchema.safeParse({ status: 'RESOLVED' }).success).toBe(true);
  });
  it('rejects invalid status', () => {
    expect(updateTicketStatusSchema.safeParse({ status: 'DELETED' }).success).toBe(false);
  });
});

// ─── Review schemas ──────────────────────────────────
describe('reviewSchema', () => {
  const valid = { customerName: 'Jane', customerPhone: '4165551234', rating: 5, verificationCode: '123456' };
  it('accepts valid review', () => {
    expect(reviewSchema.safeParse(valid).success).toBe(true);
  });
  it('rejects rating > 5', () => {
    expect(reviewSchema.safeParse({ ...valid, rating: 6 }).success).toBe(false);
  });
  it('rejects rating < 1', () => {
    expect(reviewSchema.safeParse({ ...valid, rating: 0 }).success).toBe(false);
  });
});

describe('importedReviewSchema', () => {
  it('accepts valid imported review', () => {
    expect(importedReviewSchema.safeParse({ customerName: 'John', rating: 4, relativeDate: '2 weeks ago' }).success).toBe(true);
  });
  it('rejects missing relativeDate', () => {
    expect(importedReviewSchema.safeParse({ customerName: 'John', rating: 4 }).success).toBe(false);
  });
});

describe('reviewImportPayloadSchema', () => {
  it('rejects empty reviews array', () => {
    expect(reviewImportPayloadSchema.safeParse({ tenantId: 't1', reviews: [] }).success).toBe(false);
  });
});

// ─── Auth/OTP schemas ────────────────────────────────
describe('phoneVerificationSchema', () => {
  it('accepts valid phone', () => {
    expect(phoneVerificationSchema.safeParse({ phone: '4165551234' }).success).toBe(true);
  });
  it('rejects short phone', () => {
    expect(phoneVerificationSchema.safeParse({ phone: '123' }).success).toBe(false);
  });
});

describe('forgotPasswordSchema', () => {
  it('accepts valid email', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'a@b.com' }).success).toBe(true);
  });
});

describe('resetPasswordSchema', () => {
  it('accepts valid reset', () => {
    expect(resetPasswordSchema.safeParse({ email: 'a@b.com', code: '123456', password: 'NewPass1!' }).success).toBe(true);
  });
  it('rejects weak password', () => {
    expect(resetPasswordSchema.safeParse({ email: 'a@b.com', code: '123456', password: 'weak' }).success).toBe(false);
  });
});

describe('sendOtpSchema', () => {
  it('accepts valid phone', () => {
    expect(sendOtpSchema.safeParse({ phone: '4165551234' }).success).toBe(true);
  });
});

describe('verifyOtpSchema', () => {
  it('accepts valid input', () => {
    expect(verifyOtpSchema.safeParse({ phone: '4165551234', code: '123456' }).success).toBe(true);
  });
  it('rejects wrong code length', () => {
    expect(verifyOtpSchema.safeParse({ phone: '4165551234', code: '123' }).success).toBe(false);
  });
});

// ─── Misc schemas ────────────────────────────────────
describe('chatMessageSchema', () => {
  it('accepts valid message', () => {
    expect(chatMessageSchema.safeParse({ message: 'Hello' }).success).toBe(true);
  });
  it('rejects empty message', () => {
    expect(chatMessageSchema.safeParse({ message: '' }).success).toBe(false);
  });
  it('rejects message > 500 chars', () => {
    expect(chatMessageSchema.safeParse({ message: 'x'.repeat(501) }).success).toBe(false);
  });
});

describe('checkoutSchema', () => {
  it('accepts valid checkout', () => {
    expect(checkoutSchema.safeParse({ planId: 'plan_1' }).success).toBe(true);
  });
  it('defaults billing interval to annual', () => {
    const result = checkoutSchema.parse({ planId: 'plan_1' });
    expect(result.billingInterval).toBe('annual');
  });
  it('accepts monthly interval', () => {
    expect(checkoutSchema.safeParse({ planId: 'p1', billingInterval: 'monthly' }).success).toBe(true);
  });
});

describe('deleteByIdSchema', () => {
  it('rejects empty id', () => {
    expect(deleteByIdSchema.safeParse({ id: '' }).success).toBe(false);
  });
});

describe('updateCallSchema', () => {
  it('accepts valid input', () => {
    expect(updateCallSchema.safeParse({ callId: 'c1', callbackHandled: true }).success).toBe(true);
  });
});

describe('updateCustomerSchema', () => {
  it('accepts partial update', () => {
    expect(updateCustomerSchema.safeParse({ name: 'Jane' }).success).toBe(true);
  });
  it('rejects short name', () => {
    expect(updateCustomerSchema.safeParse({ name: 'J' }).success).toBe(false);
  });
  it('allows empty email string', () => {
    expect(updateCustomerSchema.safeParse({ email: '' }).success).toBe(true);
  });
});

describe('updateAppointmentSchema', () => {
  it('accepts status update', () => {
    expect(updateAppointmentSchema.safeParse({ status: 'CONFIRMED' }).success).toBe(true);
  });
  it('rejects invalid status', () => {
    expect(updateAppointmentSchema.safeParse({ status: 'DELETED' }).success).toBe(false);
  });
  it('accepts vehicle fields', () => {
    expect(updateAppointmentSchema.safeParse({ vehicleMake: 'Toyota', vehicleModel: 'Camry' }).success).toBe(true);
  });
});

describe('createCampaignSchema', () => {
  it('accepts valid campaign', () => {
    expect(createCampaignSchema.safeParse({ name: 'Summer Sale', message: 'Get 20% off all services this weekend!' }).success).toBe(true);
  });
  it('rejects message > 320 chars', () => {
    expect(createCampaignSchema.safeParse({ name: 'Test', message: 'x'.repeat(321) }).success).toBe(false);
  });
});

describe('inviteStaffSchema', () => {
  it('accepts valid invite', () => {
    expect(inviteStaffSchema.safeParse({ email: 'staff@test.com', name: 'Jane' }).success).toBe(true);
  });
  it('rejects invalid email', () => {
    expect(inviteStaffSchema.safeParse({ email: 'bad', name: 'Jane' }).success).toBe(false);
  });
});

describe('acceptInviteSchema', () => {
  it('accepts valid input', () => {
    expect(acceptInviteSchema.safeParse({ token: 'abc123', password: 'NewPass1!' }).success).toBe(true);
  });
  it('rejects short password', () => {
    expect(acceptInviteSchema.safeParse({ token: 'abc', password: 'short' }).success).toBe(false);
  });
});
