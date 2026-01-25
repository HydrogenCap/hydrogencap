// Compliance status types and utilities

export type ComplianceStatus = 'ok' | 'due_soon' | 'overdue' | 'unknown';

export interface ComplianceStatusResult {
  status: ComplianceStatus;
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
export function getComplianceStatusColor(status: ComplianceStatus): string {
  switch (status) {
    case 'overdue':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    case 'due_soon':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
    case 'ok':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'unknown':
    default:
      return 'bg-muted text-muted-foreground';
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
