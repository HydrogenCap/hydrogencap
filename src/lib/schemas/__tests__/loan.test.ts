import { describe, it, expect } from 'vitest';
import { loanSchema, validateLoan, validateLTV } from '../loan';

describe('loanSchema', () => {
  it('accepts valid full loan data', () => {
    const result = loanSchema.safeParse({
      current_mortgage_balance_gbp: 180000,
      interest_rate_percent: 4.5,
      reversion_rate_percent: 6.0,
      fixed_rate_expires: '2026-09-01',
      loan_term_months: 300,
      term_years: 25,
      mortgage_type: 'Buy to Let',
      capital_or_interest: 'interest',
      fixed_or_variable: 'fixed',
      lender: 'The Mortgage Works',
      broker_name: 'John Smith',
      broker_contact: 'john@broker.co.uk',
      mortgage_payment_gbp: 850,
      notes: 'Fixed until Sep 2026',
    });
    expect(result.success).toBe(true);
  });

  it('accepts empty object (all fields optional)', () => {
    const result = loanSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts null for optional fields', () => {
    const result = loanSchema.safeParse({
      current_mortgage_balance_gbp: null,
      interest_rate_percent: null,
      lender: null,
    });
    expect(result.success).toBe(true);
  });

  // Balance boundaries
  it('rejects negative mortgage balance', () => {
    const result = loanSchema.safeParse({ current_mortgage_balance_gbp: -1 });
    expect(result.success).toBe(false);
  });

  it('rejects mortgage balance above 50M', () => {
    const result = loanSchema.safeParse({ current_mortgage_balance_gbp: 50000001 });
    expect(result.success).toBe(false);
  });

  it('accepts zero mortgage balance', () => {
    const result = loanSchema.safeParse({ current_mortgage_balance_gbp: 0 });
    expect(result.success).toBe(true);
  });

  // Interest rate boundaries
  it('rejects negative interest rate', () => {
    const result = loanSchema.safeParse({ interest_rate_percent: -0.5 });
    expect(result.success).toBe(false);
  });

  it('rejects interest rate above 30%', () => {
    const result = loanSchema.safeParse({ interest_rate_percent: 31 });
    expect(result.success).toBe(false);
  });

  // Term validation
  it('rejects non-integer loan_term_months', () => {
    const result = loanSchema.safeParse({ loan_term_months: 12.5 });
    expect(result.success).toBe(false);
  });

  it('rejects term exceeding 600 months', () => {
    const result = loanSchema.safeParse({ loan_term_months: 601 });
    expect(result.success).toBe(false);
  });

  it('rejects term_years exceeding 50', () => {
    const result = loanSchema.safeParse({ term_years: 51 });
    expect(result.success).toBe(false);
  });

  // Enum validation
  it('rejects invalid mortgage type', () => {
    const result = loanSchema.safeParse({ mortgage_type: 'Personal' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid payment type', () => {
    const result = loanSchema.safeParse({ capital_or_interest: 'both' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid rate type', () => {
    const result = loanSchema.safeParse({ fixed_or_variable: 'tracker' });
    expect(result.success).toBe(false);
  });

  // Date validation
  it('rejects invalid fixed_rate_expires', () => {
    const result = loanSchema.safeParse({ fixed_rate_expires: 'not-a-date' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid loan_start_date', () => {
    const result = loanSchema.safeParse({ loan_start_date: 'yesterday' });
    expect(result.success).toBe(false);
  });

  // String length validation
  it('rejects notes exceeding 2000 characters', () => {
    const result = loanSchema.safeParse({ notes: 'x'.repeat(2001) });
    expect(result.success).toBe(false);
  });

  it('rejects lender name exceeding 100 characters', () => {
    const result = loanSchema.safeParse({ lender: 'A'.repeat(101) });
    expect(result.success).toBe(false);
  });

  // Payment boundaries
  it('rejects mortgage payment above 1M', () => {
    const result = loanSchema.safeParse({ mortgage_payment_gbp: 1000001 });
    expect(result.success).toBe(false);
  });

  it('rejects negative payment override', () => {
    const result = loanSchema.safeParse({ payment_override_gbp: -100 });
    expect(result.success).toBe(false);
  });
});

describe('validateLoan helper', () => {
  it('returns success for valid data', () => {
    expect(validateLoan({ interest_rate_percent: 5.0 }).success).toBe(true);
  });

  it('returns error for invalid data', () => {
    expect(validateLoan({ interest_rate_percent: -1 }).success).toBe(false);
  });
});

describe('validateLTV', () => {
  it('returns valid when both values are null', () => {
    expect(validateLTV(null, null)).toEqual({ valid: true });
  });

  it('returns valid when mortgage is null', () => {
    expect(validateLTV(null, 250000)).toEqual({ valid: true });
  });

  it('returns valid for normal LTV (< 90%)', () => {
    const result = validateLTV(150000, 250000);
    expect(result.valid).toBe(true);
    expect(result.warning).toBeUndefined();
    expect(result.error).toBeUndefined();
  });

  it('returns warning for high LTV (90-110%)', () => {
    const result = validateLTV(240000, 250000);
    expect(result.valid).toBe(true);
    expect(result.warning).toBeDefined();
    expect(result.warning).toContain('High LTV');
  });

  it('returns error for LTV exceeding 110%', () => {
    const result = validateLTV(300000, 250000);
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('exceeds property value');
  });
});
