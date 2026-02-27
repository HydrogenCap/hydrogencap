// ============================================================
// Compliance Tasks & Notifications — Types & Constants
// ============================================================

export type TaskStatus = 'open' | 'in_progress' | 'waiting' | 'completed' | 'cancelled' | 'overdue';
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';
export type TaskType = 'renewal_due' | 'expired' | 'missing_document' | 'new_requirement' | 'follow_up' | 'inspection_scheduled' | 'certificate_received' | 'upload_pending';
export type TaskSource = 'auto' | 'manual';

export type NotificationType =
  | 'expiry_90_day' | 'expiry_60_day' | 'expiry_30_day' | 'expiry_14_day' | 'expiry_7_day'
  | 'expired' | 'escalation_1' | 'escalation_2' | 'escalation_3'
  | 'task_assigned' | 'task_overdue' | 'inspection_reminder'
  | 'resolution_confirmed' | 'missing_document' | 'custom';

export const NOTIFICATION_TYPE_NAMES: Record<NotificationType, string> = {
  expiry_90_day: '90-Day Expiry Warning',
  expiry_60_day: '60-Day Expiry Warning',
  expiry_30_day: '30-Day Expiry Warning',
  expiry_14_day: '14-Day Expiry Warning',
  expiry_7_day: '7-Day Final Warning',
  expired: 'Document Expired',
  escalation_1: 'Escalation Level 1',
  escalation_2: 'Escalation Level 2',
  escalation_3: 'Escalation Level 3',
  task_assigned: 'Task Assigned',
  task_overdue: 'Task Overdue',
  inspection_reminder: 'Inspection Reminder',
  resolution_confirmed: 'Task Resolved',
  missing_document: 'Missing Document',
  custom: 'Notification',
};

export const TASK_TYPE_NAMES: Record<TaskType, string> = {
  renewal_due: 'Renewal Due',
  expired: 'Expired',
  missing_document: 'Missing Document',
  new_requirement: 'New Requirement',
  follow_up: 'Follow Up',
  inspection_scheduled: 'Inspection Scheduled',
  certificate_received: 'Certificate Received',
  upload_pending: 'Upload Pending',
};

export const TASK_STATUS_NAMES: Record<TaskStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  waiting: 'Waiting',
  completed: 'Completed',
  cancelled: 'Cancelled',
  overdue: 'Overdue',
};

export const PRIORITY_NAMES: Record<TaskPriority, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export const BOARD_COLUMNS: TaskStatus[] = ['open', 'in_progress', 'waiting', 'completed'];

export interface ComplianceTaskOverview {
  task_id: string;
  org_id: string;
  property_id: string;
  property_address: string;
  entity_name: string | null;
  document_type: string;
  task_type: TaskType;
  title: string;
  priority: TaskPriority;
  status: TaskStatus;
  assigned_to: string | null;
  due_date: string | null;
  escalation_level: number;
  last_escalated_at: string | null;
  contractor_id: string | null;
  contractor_name: string | null;
  inspection_date: string | null;
  quoted_cost: number | null;
  actual_cost: number | null;
  source: TaskSource;
  notes: string | null;
  resolution_notes: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  is_overdue: boolean;
  days_until_due: number | null;
}

export interface ComplianceNotification {
  id: string;
  org_id: string;
  compliance_task_id: string | null;
  property_id: string | null;
  document_type: string | null;
  notification_type: NotificationType;
  channel: string;
  recipient: string | null;
  subject: string | null;
  message: string;
  status: string;
  sent_at: string;
  read_at: string | null;
  metadata: unknown;
  // from view joins
  task_title?: string;
  task_priority?: TaskPriority;
  property_address?: string;
}

export interface ComplianceScanResult {
  tasks_created: number;
  tasks_updated: number;
  notifications_sent: number;
  scan_date: string;
}
