import { LucideIcon } from 'lucide-react';

export type WizardType = 'add_property' | 'add_entity' | 'add_compliance';

export type WizardPayload = Record<string, unknown>;

export type FieldPriority = 'P0' | 'P1' | 'P2';

export interface ValidationError {
  field: string;
  message: string;
  priority: FieldPriority;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface TaskTemplate {
  title: string;
  category: string;
  priority: string;
  due_days_from_now: number;
  description?: string;
}

export interface WizardStepConfig {
  id: string;
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  validate: (data: WizardPayload) => ValidationResult;
  isOptional?: boolean;
  autoCreateTasks?: (data: WizardPayload) => TaskTemplate[];
}

export interface WizardDraft {
  id: string;
  org_id: string;
  user_id: string;
  wizard_type: WizardType;
  current_step: number;
  payload: WizardPayload;
  entity_id?: string | null;
  property_id?: string | null;
  status: 'in_progress' | 'submitted' | 'discarded';
  created_at: string;
  updated_at: string;
}

export type StepStatus = 'empty' | 'in_progress' | 'complete' | 'error';

export interface CrossCheckRule {
  id: string;
  check: (data: WizardPayload) => boolean;
  message: string;
  priority: FieldPriority;
}

export interface WizardRoom {
  id?: string;
  room_name: string;
  room_type: string;
  floor: number;
  has_ensuite: boolean;
  is_lettable: boolean;
  target_rent_pcm?: number;
}

export interface ComplianceItem {
  document_type: string;
  display_name: string;
  is_required: boolean;
  review_frequency_months: number | null;
  lead_time_days: number;
  reason: string;
  override_reason?: string;
  expiry_date?: string;
  contractor_name?: string;
  estimated_cost?: number;
}
