import { describe, it, expect } from 'vitest';
import { passwordSchema } from './passwordSchema';

describe('passwordSchema', () => {
  it('accepts a valid password', () => {
    expect(passwordSchema.safeParse('SecureP1').success).toBe(true);
    expect(passwordSchema.safeParse('MyPassword123').success).toBe(true);
  });

  it('rejects passwords shorter than 8 characters', () => {
    const result = passwordSchema.safeParse('Ab1');
    expect(result.success).toBe(false);
  });

  it('rejects passwords without uppercase', () => {
    const result = passwordSchema.safeParse('lowercase1');
    expect(result.success).toBe(false);
  });

  it('rejects passwords without lowercase', () => {
    const result = passwordSchema.safeParse('UPPERCASE1');
    expect(result.success).toBe(false);
  });

  it('rejects passwords without a number', () => {
    const result = passwordSchema.safeParse('NoNumbersHere');
    expect(result.success).toBe(false);
  });

  it('rejects passwords longer than 72 characters', () => {
    const longPassword = 'A1' + 'a'.repeat(71);
    const result = passwordSchema.safeParse(longPassword);
    expect(result.success).toBe(false);
  });

  it('accepts exactly 8 character valid password', () => {
    expect(passwordSchema.safeParse('Abcdef1!').success).toBe(true);
  });
});
