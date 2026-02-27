// Phase 2.3: Maintenance & Works Orders — Types & Constants

export type MaintenanceCategory =
  | 'plumbing' | 'electrical' | 'heating' | 'structural' | 'damp_mould'
  | 'pest_control' | 'appliance' | 'locks_security' | 'windows_doors'
  | 'flooring' | 'painting_decorating' | 'garden_external' | 'cleaning'
  | 'fire_safety' | 'furniture' | 'communal_areas' | 'roof_guttering'
  | 'drainage' | 'other';

export type MaintenancePriority = 'emergency' | 'urgent' | 'medium' | 'low';

export type MaintenanceStatus =
  | 'reported' | 'triaged' | 'quoted' | 'approved' | 'scheduled'
  | 'in_progress' | 'completed' | 'verified' | 'closed' | 'cancelled' | 'on_hold';

export type WorksOrderStatus =
  | 'draft' | 'sent_to_contractor' | 'quote_received' | 'approved'
  | 'scheduled' | 'in_progress' | 'completed' | 'invoiced' | 'paid'
  | 'cancelled' | 'disputed';

export type ReportedBy = 'tenant' | 'operator' | 'contractor' | 'inspector' | 'agent';
export type CommentAuthorType = 'operator' | 'tenant' | 'contractor' | 'system';
export type TimeSlot = 'morning' | 'afternoon' | 'all_day' | 'specific';
export type PaymentMethod = 'bank_transfer' | 'card' | 'cash' | 'cheque' | 'account';

export const MAINTENANCE_CATEGORY_NAMES: Record<MaintenanceCategory, string> = {
  plumbing: 'Plumbing',
  electrical: 'Electrical',
  heating: 'Heating & Boilers',
  structural: 'Structural',
  damp_mould: 'Damp & Mould',
  pest_control: 'Pest Control',
  appliance: 'Appliances',
  locks_security: 'Locks & Security',
  windows_doors: 'Windows & Doors',
  flooring: 'Flooring',
  painting_decorating: 'Painting & Decorating',
  garden_external: 'Garden & External',
  cleaning: 'Cleaning',
  fire_safety: 'Fire Safety Equipment',
  furniture: 'Furniture',
  communal_areas: 'Communal Areas',
  roof_guttering: 'Roof & Guttering',
  drainage: 'Drainage',
  other: 'Other',
};

export const CATEGORY_COLORS: Record<MaintenanceCategory, string> = {
  plumbing: 'bg-blue-100 text-blue-800 border-blue-200',
  electrical: 'bg-amber-100 text-amber-800 border-amber-200',
  heating: 'bg-orange-100 text-orange-800 border-orange-200',
  structural: 'bg-red-100 text-red-800 border-red-200',
  damp_mould: 'bg-teal-100 text-teal-800 border-teal-200',
  pest_control: 'bg-green-100 text-green-800 border-green-200',
  appliance: 'bg-purple-100 text-purple-800 border-purple-200',
  locks_security: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  windows_doors: 'bg-slate-100 text-slate-800 border-slate-200',
  flooring: 'bg-slate-100 text-slate-800 border-slate-200',
  painting_decorating: 'bg-slate-100 text-slate-800 border-slate-200',
  garden_external: 'bg-slate-100 text-slate-800 border-slate-200',
  cleaning: 'bg-slate-100 text-slate-800 border-slate-200',
  fire_safety: 'bg-red-100 text-red-800 border-red-200',
  furniture: 'bg-slate-100 text-slate-800 border-slate-200',
  communal_areas: 'bg-slate-100 text-slate-800 border-slate-200',
  roof_guttering: 'bg-slate-100 text-slate-800 border-slate-200',
  drainage: 'bg-slate-100 text-slate-800 border-slate-200',
  other: 'bg-slate-100 text-slate-800 border-slate-200',
};

export const PRIORITY_CONFIG: Record<MaintenancePriority, { label: string; color: string; icon: string }> = {
  emergency: { label: 'Emergency', color: 'bg-red-100 text-red-800 border-red-200', icon: '🚨' },
  urgent: { label: 'Urgent', color: 'bg-orange-100 text-orange-800 border-orange-200', icon: '🔴' },
  medium: { label: 'Medium', color: 'bg-amber-100 text-amber-800 border-amber-200', icon: '🟡' },
  low: { label: 'Low', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: '🔵' },
};

export const STATUS_CONFIG: Record<MaintenanceStatus, { label: string; color: string }> = {
  reported: { label: 'Reported', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  triaged: { label: 'Triaged', color: 'bg-sky-100 text-sky-800 border-sky-200' },
  quoted: { label: 'Quoted', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  approved: { label: 'Approved', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  scheduled: { label: 'Scheduled', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  in_progress: { label: 'In Progress', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-800 border-green-200' },
  verified: { label: 'Verified', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  closed: { label: 'Closed', color: 'bg-gray-100 text-gray-600 border-gray-200' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-500 border-gray-200' },
  on_hold: { label: 'On Hold', color: 'bg-slate-100 text-slate-700 border-slate-200' },
};

export const WORKS_ORDER_STATUS_CONFIG: Record<WorksOrderStatus, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700' },
  sent_to_contractor: { label: 'Sent', color: 'bg-blue-100 text-blue-800' },
  quote_received: { label: 'Quote Received', color: 'bg-purple-100 text-purple-800' },
  approved: { label: 'Approved', color: 'bg-indigo-100 text-indigo-800' },
  scheduled: { label: 'Scheduled', color: 'bg-amber-100 text-amber-800' },
  in_progress: { label: 'In Progress', color: 'bg-orange-100 text-orange-800' },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-800' },
  invoiced: { label: 'Invoiced', color: 'bg-teal-100 text-teal-800' },
  paid: { label: 'Paid', color: 'bg-emerald-100 text-emerald-800' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-500' },
  disputed: { label: 'Disputed', color: 'bg-red-100 text-red-800' },
};

export const WORKS_ORDER_PIPELINE: WorksOrderStatus[] = [
  'draft', 'sent_to_contractor', 'quote_received', 'approved',
  'scheduled', 'in_progress', 'completed', 'invoiced', 'paid',
];

export interface MaintenanceOverviewRow {
  request_id: string;
  org_id: string;
  property_id: string;
  property_address: string;
  room_id: string | null;
  room_name: string | null;
  tenant_id: string | null;
  tenant_name: string | null;
  category: MaintenanceCategory;
  priority: MaintenancePriority;
  title: string;
  description: string | null;
  status: MaintenanceStatus;
  is_emergency: boolean;
  is_recurring: boolean;
  reported_date: string;
  reported_by: ReportedBy;
  days_open: number;
  works_order_id: string | null;
  order_number: string | null;
  contractor_id: string | null;
  contractor_name: string | null;
  works_order_status: WorksOrderStatus | null;
  quoted_amount: number | null;
  approved_amount: number | null;
  invoice_amount: number | null;
  scheduled_date: string | null;
  completion_date: string | null;
  comment_count: number;
}

export interface MaintenanceSpendByProperty {
  property_id: string;
  org_id: string;
  property_address: string;
  total_jobs: number;
  completed_jobs: number;
  total_invoiced: number;
  total_paid: number;
  avg_job_cost: number;
  avg_days_to_complete: number;
}

export interface MaintenanceSpendByCategory {
  org_id: string;
  category: MaintenanceCategory;
  job_count: number;
  total_spend: number;
  avg_cost: number;
  avg_resolution_days: number;
}

export interface ContractorPerformanceRow {
  contractor_id: string;
  org_id: string;
  company_name: string;
  service_types: string[];
  rating: number | null;
  total_jobs: number;
  completed_jobs: number;
  total_paid: number;
  avg_job_cost: number;
  avg_days_over_schedule: number;
  avg_report_to_completion_days: number;
  disputed_jobs: number;
}

export interface RecurringIssueRow {
  org_id: string;
  property_id: string;
  property_address: string;
  category: MaintenanceCategory;
  request_count: number;
  first_reported: string;
  last_reported: string;
  total_spend: number;
}

export const OPEN_STATUSES: MaintenanceStatus[] = [
  'reported', 'triaged', 'quoted', 'approved', 'scheduled', 'in_progress', 'on_hold',
];

export const CLOSED_STATUSES: MaintenanceStatus[] = [
  'completed', 'verified', 'closed', 'cancelled',
];
