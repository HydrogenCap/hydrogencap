import type { ComplianceTaskOverview, TaskStatus } from '@/lib/complianceTaskTypes';

// Map legacy statuses to pipeline columns for display
export function getColumnForTask(t: ComplianceTaskOverview): TaskStatus {
  if (['completed', 'cancelled'].includes(t.status)) return 'completed';
  if (['contractor_assigned', 'contractor_requested', 'awaiting_upload', 'pending'].includes(t.status)) return t.status as TaskStatus;
  if (t.status === 'waiting') return 'awaiting_upload';
  if (t.status === 'in_progress') return 'contractor_assigned';
  return 'pending'; // 'open' maps to 'pending'
}
