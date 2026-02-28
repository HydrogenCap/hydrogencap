import { Home, Shield, FileUp, CheckSquare } from 'lucide-react';
import type { WizardStepConfig, WizardPayload, ValidationResult } from './types';

function ok(): ValidationResult {
  return { valid: true, errors: [] };
}

export const COMPLIANCE_STEPS: WizardStepConfig[] = [
  {
    id: 'select_property',
    title: 'Select Property',
    subtitle: 'Choose the property to update compliance for',
    icon: Home,
    validate: (d: WizardPayload): ValidationResult => {
      const errors = [];
      if (!d.property_id) errors.push({ field: 'property_id', message: 'Property is required', priority: 'P0' as const });
      return { valid: errors.length === 0, errors };
    },
  },
  {
    id: 'compliance_type',
    title: 'Compliance Type',
    subtitle: 'Select the document type',
    icon: Shield,
    validate: (d: WizardPayload): ValidationResult => {
      const errors = [];
      if (!d.document_type) errors.push({ field: 'document_type', message: 'Document type is required', priority: 'P0' as const });
      if (!d.issue_date) errors.push({ field: 'issue_date', message: 'Issue date is required', priority: 'P0' as const });
      return { valid: errors.length === 0, errors };
    },
  },
  {
    id: 'upload_certificate',
    title: 'Upload Certificate',
    subtitle: 'Attach the compliance document',
    icon: FileUp,
    isOptional: true,
    validate: (): ValidationResult => ok(),
  },
  {
    id: 'compliance_review',
    title: 'Review & Submit',
    subtitle: 'Confirm and submit',
    icon: CheckSquare,
    validate: (): ValidationResult => ok(),
  },
];

export const COMPLIANCE_CROSS_CHECKS = [
  {
    id: 'expiry_before_issue',
    check: (d: WizardPayload) => {
      if (!d.issue_date || !d.expiry_date) return false;
      return new Date(d.expiry_date as string) <= new Date(d.issue_date as string);
    },
    message: 'Expiry date must be after issue date',
    priority: 'P0' as const,
  },
];
