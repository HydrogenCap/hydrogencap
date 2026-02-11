import { z } from 'zod';

/**
 * Shared password validation schema.
 * Enforces OWASP-aligned policy: 8+ chars, at least one uppercase, one lowercase, one number.
 */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be less than 72 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

/**
 * Hint text to display below password fields.
 */
export const PASSWORD_HINT = 'At least 8 characters with one uppercase letter, one lowercase letter, and one number.';
