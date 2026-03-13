import { describe, it, expect, beforeAll } from 'vitest';
import { encrypt, decrypt, isEncrypted, hashOtp } from '@/lib/crypto';

beforeAll(() => {
  process.env.ENCRYPTION_KEY = 'test-encryption-key-for-vitest-suite';
});

describe('encrypt / decrypt', () => {
  it('round-trips a simple string', () => {
    const plain = 'sk_live_abc123';
    const cipher = encrypt(plain);
    expect(decrypt(cipher)).toBe(plain);
  });

  it('round-trips unicode / emoji', () => {
    const plain = 'Hello 🌎 café résumé';
    expect(decrypt(encrypt(plain))).toBe(plain);
  });

  it('round-trips an empty string', () => {
    expect(decrypt(encrypt(''))).toBe('');
  });

  it('produces different ciphertexts for the same plaintext (random IV)', () => {
    const plain = 'same-input';
    const a = encrypt(plain);
    const b = encrypt(plain);
    expect(a).not.toBe(b);
    // Both must still decrypt to the original
    expect(decrypt(a)).toBe(plain);
    expect(decrypt(b)).toBe(plain);
  });

  it('throws on tampered ciphertext', () => {
    const cipher = encrypt('secret');
    const parts = cipher.split(':');
    // Flip a character in the encrypted portion
    parts[2] = parts[2].slice(0, -1) + (parts[2].endsWith('0') ? '1' : '0');
    expect(() => decrypt(parts.join(':'))).toThrow();
  });

  it('throws on invalid format (missing parts)', () => {
    expect(() => decrypt('not-valid')).toThrow('Invalid ciphertext format');
  });

  it('throws on swapped iv and tag', () => {
    const cipher = encrypt('test');
    const parts = cipher.split(':');
    // Swap IV and tag — should fail authentication
    const swapped = parts[1] + ':' + parts[0] + ':' + parts[2];
    expect(() => decrypt(swapped)).toThrow();
  });
});

describe('isEncrypted', () => {
  it('returns true for a valid encrypted string', () => {
    const cipher = encrypt('test');
    expect(isEncrypted(cipher)).toBe(true);
  });

  it('returns false for plain text', () => {
    expect(isEncrypted('plain-text-value')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isEncrypted('')).toBe(false);
  });
});

describe('hashOtp', () => {
  it('returns a 64-char hex string (SHA-256)', () => {
    const hash = hashOtp('123456');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic', () => {
    expect(hashOtp('999999')).toBe(hashOtp('999999'));
  });

  it('different inputs produce different hashes', () => {
    expect(hashOtp('111111')).not.toBe(hashOtp('222222'));
  });
});
