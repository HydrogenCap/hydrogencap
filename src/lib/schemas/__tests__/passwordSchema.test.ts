import { describe, it, expect } from 'vitest';
import { passwordSchema } from '../../passwordSchema';

describe('passwordSchema', () => {
  it('accepts valid password', () => {
    const result = passwordSchema.safeParse('SecurePass1');
    expect(result.success).toBe(true);
  });

  it('accepts password at minimum length (8 chars)', () => {
    const result = passwordSchema.safeParse('Abcdef1x');
    expect(result.success).toBe(true);
  });

  it('accepts password at maximum length (72 chars)', () => {
    const result = passwordSchema.safeParse('Aa1' + 'x'.repeat(69));
    expect(result.success).toBe(true);
  });

  it('rejects password shorter than 8 characters', () => {
    const result = passwordSchema.safeParse('Ab1cdef');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('at least 8');
    }
  });

  it('rejects password longer than 72 characters', () => {
    const result = passwordSchema.safeParse('Aa1' + 'x'.repeat(70));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('less than 72');
    }
  });

  it('rejects password without uppercase letter', () => {
    const result = passwordSchema.safeParse('lowercase1');
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map(i => i.message);
      expect(messages.some(m => m.includes('uppercase'))).toBe(true);
    }
  });

  it('rejects password without lowercase letter', () => {
    const result = passwordSchema.safeParse('UPPERCASE1');
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map(i => i.message);
      expect(messages.some(m => m.includes('lowercase'))).toBe(true);
    }
  });

  it('rejects password without number', () => {
    const result = passwordSchema.safeParse('NoNumbers');
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map(i => i.message);
      expect(messages.some(m => m.includes('number'))).toBe(true);
    }
  });

  it('rejects empty string', () => {
    const result = passwordSchema.safeParse('');
    expect(result.success).toBe(false);
  });

  it('accepts password with special characters', () => {
    const result = passwordSchema.safeParse('P@ssw0rd!£$');
    expect(result.success).toBe(true);
  });
});
