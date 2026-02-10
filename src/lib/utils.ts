import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { z } from "zod";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Strip HTML tags and dangerous characters from user input.
 * Prevents XSS when text is rendered or stored.
 */
export function sanitizeText(input: string): string {
  return input
    .replace(/<[^>]*>/g, '') // strip HTML tags
    .replace(/javascript:/gi, '') // strip javascript: protocol
    .replace(/on\w+\s*=/gi, '') // strip inline event handlers
    .trim();
}

/**
 * Zod refinement for sanitized text fields.
 * Use: z.string().transform(sanitizeText) or pipe through this schema.
 */
export const sanitizedString = z.string().transform(sanitizeText);

/**
 * Optional sanitized string (nullable).
 */
export const optionalSanitizedString = z
  .string()
  .optional()
  .nullable()
  .transform((val) => (val ? sanitizeText(val) : val));
