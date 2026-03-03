import { describe, it, expect } from 'vitest';
import { registerSchema, createAppointmentSchema } from '@/lib/validations';

describe('registerSchema', () => {
  const validInput = {
    name: 'John Doe',
    email: 'john@example.com',
    password: 'Password1',
    businessName: 'My Business',
  };

  it('accepts valid input', () => {
    const result = registerSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('accepts valid input with optional phone', () => {
    const result = registerSchema.safeParse({ ...validInput, phone: '+11234567890' });
    expect(result.success).toBe(true);
  });

  it('rejects weak password (too short)', () => {
    const result = registerSchema.safeParse({ ...validInput, password: 'Ab1' });
    expect(result.success).toBe(false);
  });

  it('rejects password without uppercase', () => {
    const result = registerSchema.safeParse({ ...validInput, password: 'password1' });
    expect(result.success).toBe(false);
  });

  it('rejects password without lowercase', () => {
    const result = registerSchema.safeParse({ ...validInput, password: 'PASSWORD1' });
    expect(result.success).toBe(false);
  });

  it('rejects password without a number', () => {
    const result = registerSchema.safeParse({ ...validInput, password: 'Passwordd' });
    expect(result.success).toBe(false);
  });

  it('rejects missing name', () => {
    const { name: _, ...noName } = validInput;
    const result = registerSchema.safeParse(noName);
    expect(result.success).toBe(false);
  });

  it('rejects missing email', () => {
    const { email: _, ...noEmail } = validInput;
    const result = registerSchema.safeParse(noEmail);
    expect(result.success).toBe(false);
  });

  it('rejects invalid email', () => {
    const result = registerSchema.safeParse({ ...validInput, email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('rejects missing businessName', () => {
    const { businessName: _, ...noBiz } = validInput;
    const result = registerSchema.safeParse(noBiz);
    expect(result.success).toBe(false);
  });

  it('rejects name that is too short', () => {
    const result = registerSchema.safeParse({ ...validInput, name: 'A' });
    expect(result.success).toBe(false);
  });
});

describe('createAppointmentSchema', () => {
  const validAppointment = {
    serviceId: 'svc-123',
    customerName: 'Jane Doe',
    customerPhone: '1234567890',
    date: '2025-01-15',
    startTime: '09:00',
  };

  it('accepts valid input', () => {
    const result = createAppointmentSchema.safeParse(validAppointment);
    expect(result.success).toBe(true);
  });

  it('accepts valid input with all optional fields', () => {
    const result = createAppointmentSchema.safeParse({
      ...validAppointment,
      serviceOptionId: 'opt-1',
      quantity: 2,
      selectedSubOptionIds: ['sub-1', 'sub-2'],
      customerEmail: 'jane@example.com',
      notes: 'First time visit',
      verificationCode: '123456',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty date', () => {
    const result = createAppointmentSchema.safeParse({ ...validAppointment, date: '' });
    expect(result.success).toBe(false);
  });

  it('rejects empty startTime', () => {
    const result = createAppointmentSchema.safeParse({ ...validAppointment, startTime: '' });
    expect(result.success).toBe(false);
  });

  it('rejects missing serviceId', () => {
    const { serviceId: _, ...noService } = validAppointment;
    const result = createAppointmentSchema.safeParse(noService);
    expect(result.success).toBe(false);
  });

  it('rejects short customerName', () => {
    const result = createAppointmentSchema.safeParse({ ...validAppointment, customerName: 'A' });
    expect(result.success).toBe(false);
  });

  it('rejects short customerPhone', () => {
    const result = createAppointmentSchema.safeParse({ ...validAppointment, customerPhone: '123' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid customerEmail', () => {
    const result = createAppointmentSchema.safeParse({
      ...validAppointment,
      customerEmail: 'not-an-email',
    });
    expect(result.success).toBe(false);
  });

  it('allows empty string for customerEmail', () => {
    const result = createAppointmentSchema.safeParse({
      ...validAppointment,
      customerEmail: '',
    });
    expect(result.success).toBe(true);
  });

  it('rejects verificationCode with wrong length', () => {
    const result = createAppointmentSchema.safeParse({
      ...validAppointment,
      verificationCode: '123',
    });
    expect(result.success).toBe(false);
  });
});
