import { Building, Users, FileText, CheckSquare } from 'lucide-react';
import type { WizardStepConfig, WizardPayload, ValidationResult } from './types';

function ok(): ValidationResult {
  return { valid: true, errors: [] };
}

export const ENTITY_STEPS: WizardStepConfig[] = [
  {
    id: 'entity_details',
    title: 'Entity Details',
    subtitle: 'Company or individual details',
    icon: Building,
    validate: (d: WizardPayload): ValidationResult => {
      const errors = [];
      if (!d.entity_name) errors.push({ field: 'entity_name', message: 'Entity name is required', priority: 'P0' as const });
      if (!d.entity_type) errors.push({ field: 'entity_type', message: 'Entity type is required', priority: 'P0' as const });
      return { valid: errors.length === 0, errors };
    },
  },
  {
    id: 'shareholders',
    title: 'Shareholders',
    subtitle: 'Ownership structure',
    icon: Users,
    isOptional: true,
    validate: (): ValidationResult => ok(),
  },
  {
    id: 'entity_documents',
    title: 'Documents',
    subtitle: 'Upload formation documents',
    icon: FileText,
    isOptional: true,
    validate: (): ValidationResult => ok(),
  },
  {
    id: 'entity_review',
    title: 'Review & Submit',
    subtitle: 'Confirm entity details',
    icon: CheckSquare,
    validate: (): ValidationResult => ok(),
  },
];

export const ENTITY_CROSS_CHECKS = [
  {
    id: 'company_number_missing',
    check: (d: WizardPayload) => d.entity_type === 'ltd_company' && !d.company_number,
    message: 'Limited companies should have a Companies House number',
    priority: 'P1' as const,
  },
];
