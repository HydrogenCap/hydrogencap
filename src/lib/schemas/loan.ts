import { z } from 'zod';

// Mortgage Types
export const MORTGAGE_TYPES = ['Buy to Let', 'Commercial', 'Bridging', 'Development'] as const;
export type MortgageType = typeof MORTGAGE_TYPES[number];

// Capital or Interest
export const PAYMENT_TYPES = ['capital', 'interest'] as const;
export type PaymentType = typeof PAYMENT_TYPES[number];

// Fixed or Variable
export const RATE_TYPES = ['fixed', 'variable'] as const;
export type RateType = typeof RATE_TYPES[number];

// Loan validation schema
export const loanSchema = z.object({
  current_mortgage_balance_gbp: z
    .number()
    .min(0, 'Mortgage balance cannot be negative')
    .max(50000000, 'Mortgage balance seems too high (maximum £50M)')
    .optional()
    .nullable(),
  
  interest_rate_percent: z
    .number()
    .min(0, 'Interest rate cannot be negative')
    .max(30, 'Interest rate seems too high (maximum 30%)')
    .optional()
    .nullable(),
  
  reversion_rate_percent: z
    .number()
    .min(0, 'Reversion rate cannot be negative')
    .max(30, 'Reversion rate seems too high')
    .optional()
    .nullable(),
  
  fixed_rate_expires: z
    .string()
    .optional()
    .nullable()
    .refine(
      (val) => !val || !isNaN(Date.parse(val)),
      'Invalid date format'
    ),
  
  loan_term_months: z
    .number()
    .int('Term must be a whole number of months')
    .min(1, 'Loan term must be at least 1 month')
    .max(600, 'Loan term cannot exceed 50 years')
    .optional()
    .nullable(),
  
  term_years: z
    .number()
    .int('Term must be a whole number of years')
    .min(1, 'Loan term must be at least 1 year')
    .max(50, 'Loan term cannot exceed 50 years')
    .optional()
    .nullable(),
  
  mortgage_type: z
    .enum(MORTGAGE_TYPES)
    .optional()
    .nullable(),
  
  capital_or_interest: z
    .enum(PAYMENT_TYPES)
    .optional()
    .nullable(),
  
  fixed_or_variable: z
    .enum(RATE_TYPES)
    .optional()
    .nullable(),
  
  lender: z
    .string()
    .max(100, 'Lender name is too long')
    .optional()
    .nullable(),
  
  broker_name: z
    .string()
    .max(100, 'Broker name is too long')
    .optional()
    .nullable(),
  
  broker_contact: z
    .string()
    .max(200, 'Broker contact is too long')
    .optional()
    .nullable(),
  
  mortgage_payment_gbp: z
    .number()
    .min(0, 'Payment cannot be negative')
    .max(1000000, 'Monthly payment seems too high')
    .optional()
    .nullable(),
  
  payment_override_gbp: z
    .number()
    .min(0, 'Payment override cannot be negative')
    .max(1000000, 'Payment override seems too high')
    .optional()
    .nullable(),
  
  loan_start_date: z
    .string()
    .optional()
    .nullable()
    .refine(
      (val) => !val || !isNaN(Date.parse(val)),
      'Invalid date format'
    ),
  
  refinance_target_date: z
    .string()
    .optional()
    .nullable()
    .refine(
      (val) => !val || !isNaN(Date.parse(val)),
      'Invalid date format'
    ),
  
  notes: z
    .string()
    .max(2000, 'Notes are too long')
    .optional()
    .nullable(),
});

// Schema with property value context for LTV validation
export const loanWithContextSchema = loanSchema.refine(
  (_data) => {
    // Note: Property value validation should be done at the form level
    // where we have access to the property context
    return true;
  }
);

// Type exports
export type LoanFormData = z.infer<typeof loanSchema>;

// Validation helpers
export function validateLoan(data: unknown) {
  return loanSchema.safeParse(data);
}

// LTV sanity check helper (use at form level with property context)
export function validateLTV(mortgageBalance: number | null, propertyValue: number | null): {
  valid: boolean;
  warning?: string;
  error?: string;
} {
  if (!mortgageBalance || !propertyValue) {
    return { valid: true };
  }
  
  const ltv = (mortgageBalance / propertyValue) * 100;
  
  if (ltv > 110) {
    return {
      valid: false,
      error: `Mortgage balance exceeds property value by ${(ltv - 100).toFixed(0)}% - please verify figures`,
    };
  }
  
  if (ltv > 90) {
    return {
      valid: true,
      warning: `High LTV (${ltv.toFixed(0)}%) - this may indicate refinancing needs`,
    };
  }
  
  return { valid: true };
}
