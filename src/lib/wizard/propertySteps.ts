import {
  MapPin,
  Building2,
  Layers,
  DoorOpen,
  Shield,
  Landmark,
  FileText,
  CheckSquare,
} from 'lucide-react';
import type { WizardStepConfig, WizardPayload, ValidationResult, ComplianceItem, WizardRoom } from './types';

function ok(): ValidationResult {
  return { valid: true, errors: [] };
}

export const PROPERTY_STEPS: WizardStepConfig[] = [
  {
    id: 'address',
    title: 'Address',
    subtitle: 'Property location and basic details',
    icon: MapPin,
    validate: (d: WizardPayload): ValidationResult => {
      const errors = [];
      if (!d.address_line_1) errors.push({ field: 'address_line_1', message: 'Address line 1 is required', priority: 'P0' as const });
      if (!d.city) errors.push({ field: 'city', message: 'City / town is required', priority: 'P0' as const });
      if (!d.postcode) errors.push({ field: 'postcode', message: 'Postcode is required', priority: 'P0' as const });
      return { valid: errors.length === 0, errors };
    },
  },
  {
    id: 'type',
    title: 'Property Type',
    subtitle: 'Classification, lifecycle stage, and strategy',
    icon: Building2,
    validate: (d: WizardPayload): ValidationResult => {
      const errors = [];
      if (!d.property_type) errors.push({ field: 'property_type', message: 'Property type is required', priority: 'P0' as const });
      if (!d.lifecycle_stage) errors.push({ field: 'lifecycle_stage', message: 'Lifecycle stage is required', priority: 'P0' as const });
      return { valid: errors.length === 0, errors };
    },
  },
  {
    id: 'ownership',
    title: 'Ownership',
    subtitle: 'Legal entity and listing grade',
    icon: Layers,
    validate: (d: WizardPayload): ValidationResult => {
      const errors = [];
      if (!d.entity_id) errors.push({ field: 'entity_id', message: 'Owning entity is required — create one if needed', priority: 'P0' as const });
      return { valid: errors.length === 0, errors };
    },
  },
  {
    id: 'rooms',
    title: 'Rooms & Layout',
    subtitle: 'Define rooms and amenities',
    icon: DoorOpen,
    isOptional: true,
    validate: (d: WizardPayload): ValidationResult => {
      const errors = [];
      const isHmo = ['hmo_licensed', 'hmo_mandatory'].includes(d.property_type as string);
      const rooms = (d.rooms as WizardRoom[]) || [];
      if (isHmo && rooms.length === 0) {
        errors.push({ field: 'rooms', message: 'HMO properties must have at least 1 room', priority: 'P0' as const });
      }
      if (!isHmo && rooms.length === 0) {
        errors.push({ field: 'rooms', message: 'Consider adding rooms for better tracking', priority: 'P2' as const });
      }
      return { valid: errors.length === 0, errors };
    },
  },
  {
    id: 'compliance',
    title: 'Compliance',
    subtitle: 'Required certificates and documents',
    icon: Shield,
    validate: (d: WizardPayload): ValidationResult => {
      const errors = [];
      const items = (d.compliance_items as ComplianceItem[]) || [];
      if (items.length === 0) {
        errors.push({ field: 'compliance_items', message: 'No compliance items configured', priority: 'P1' as const });
      }
      const missing = items.filter((c) => c.is_required && !c.expiry_date);
      if (missing.length > 0) {
        errors.push({
          field: 'compliance_items',
          message: `${missing.length} required item${missing.length > 1 ? 's' : ''} missing expiry date`,
          priority: 'P1' as const,
        });
      }
      return { valid: errors.length === 0, errors };
    },
  },
  {
    id: 'finance',
    title: 'Finance',
    subtitle: 'Mortgage, valuation, and purchase details',
    icon: Landmark,
    validate: (d: WizardPayload): ValidationResult => {
      const errors = [];
      if (d.has_mortgage === true) {
        if (!d.lender_name) errors.push({ field: 'lender_name', message: 'Lender name is required when mortgage exists', priority: 'P0' as const });
        if (!d.original_amount) errors.push({ field: 'original_amount', message: 'Original loan amount is required', priority: 'P0' as const });
        if (!d.interest_rate) errors.push({ field: 'interest_rate', message: 'Interest rate is required', priority: 'P0' as const });
      }
      if (!d.current_valuation) {
        errors.push({ field: 'current_valuation', message: 'Current valuation improves reporting accuracy', priority: 'P2' as const });
      }
      return { valid: errors.length === 0, errors };
    },
  },
  {
    id: 'documents',
    title: 'Documents',
    subtitle: 'Upload key property documents',
    icon: FileText,
    isOptional: true,
    validate: (): ValidationResult => ok(),
  },
  {
    id: 'review',
    title: 'Review & Submit',
    subtitle: 'Check everything before submitting',
    icon: CheckSquare,
    validate: (): ValidationResult => ok(),
  },
];
