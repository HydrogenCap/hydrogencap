/**
 * TenureIQ Design Tokens
 * Centralised design constants to prevent ad-hoc colour and spacing decisions.
 */

// Severity colours — use for badges, alerts, status indicators
export const SEVERITY = {
  critical: {
    bg: 'bg-red-500/10',
    text: 'text-red-700 dark:text-red-400',
    border: 'border-red-200 dark:border-red-800',
    badge: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    dot: 'bg-red-500',
  },
  warning: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-700 dark:text-amber-400',
    border: 'border-amber-200 dark:border-amber-800',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
  info: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-700 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-800',
    badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    dot: 'bg-blue-500',
  },
  success: {
    bg: 'bg-green-500/10',
    text: 'text-green-700 dark:text-green-400',
    border: 'border-green-200 dark:border-green-800',
    badge: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    dot: 'bg-green-500',
  },
  neutral: {
    bg: 'bg-muted/50',
    text: 'text-muted-foreground',
    border: 'border-border',
    badge: 'bg-muted text-muted-foreground',
    dot: 'bg-muted-foreground',
  },
} as const;

export type SeverityLevel = keyof typeof SEVERITY;

// Card sizes
export const CARD = {
  compact: 'p-4 gap-3',
  standard: 'p-6 gap-4',
  spacious: 'p-8 gap-6',
} as const;

// Typography scale
export const TEXT = {
  pageTitle: 'text-2xl font-bold tracking-tight',
  sectionHeading: 'text-lg font-semibold',
  cardTitle: 'text-base font-medium',
  body: 'text-sm',
  label: 'text-xs text-muted-foreground',
  caption: 'text-xs text-muted-foreground',
} as const;

// Compliance status mapping to severity
export const COMPLIANCE_SEVERITY: Record<string, SeverityLevel> = {
  expired: 'critical',
  expiring: 'warning',
  valid: 'success',
  missing: 'critical',
  not_applicable: 'neutral',
  pending: 'info',
} as const;

// Action priority mapping to severity
export const ACTION_SEVERITY: Record<string, SeverityLevel> = {
  critical: 'critical',
  high: 'warning',
  medium: 'info',
  low: 'neutral',
} as const;

// Helper to get severity classes
export function getSeverityClasses(level: SeverityLevel) {
  return SEVERITY[level];
}
