// Compliance status types and utilities
import { SEVERITY } from '@/lib/design-tokens';

export type FilingComplianceStatus = 'ok' | 'due_soon' | 'overdue' | 'unknown';

export interface ComplianceStatusResult {
  status: FilingComplianceStatus;
  daysUntilDue: number | null;
  label: string;
}

/**
 * Calculate compliance status based on a due date
 * - Overdue: due_date < today
 * - Due soon: due_date between today and today + 30 days
 * - OK: due_date > today + 30 days
 */
export function getComplianceStatus(dueDate: string | null | undefined): ComplianceStatusResult {
  if (!dueDate) {
    return { status: 'unknown', daysUntilDue: null, label: 'Unknown' };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  
  const diffTime = due.getTime() - today.getTime();
  const daysUntilDue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (daysUntilDue < 0) {
    return { 
      status: 'overdue', 
      daysUntilDue, 
      label: `${Math.abs(daysUntilDue)} days overdue` 
    };
  }

  if (daysUntilDue <= 30) {
    return { 
      status: 'due_soon', 
      daysUntilDue, 
      label: daysUntilDue === 0 ? 'Due today' : `Due in ${daysUntilDue} days` 
    };
  }

  return { 
    status: 'ok', 
    daysUntilDue, 
    label: `Due in ${daysUntilDue} days` 
  };
}

/**
 * Get the CSS class for a compliance status badge
 */
export function getComplianceStatusColor(status: FilingComplianceStatus): string {
  switch (status) {
    case 'overdue':
      return SEVERITY.critical.badge;
    case 'due_soon':
      return SEVERITY.warning.badge;
    case 'ok':
      return SEVERITY.success.badge;
    case 'unknown':
    default:
      return SEVERITY.neutral.badge;
  }
}

/**
 * Format a date for display
 */
export function formatComplianceDate(date: string | null | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
