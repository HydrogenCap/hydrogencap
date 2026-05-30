import { PropertyWithFinancials } from '@/hooks/usePropertiesCompat';

export interface DataQualityWidgetProps {
  properties: PropertyWithFinancials[];
}

export interface AffectedProperty {
  id: string;
  address: string;
  area: string | null;
  ownership: string | null;
  missingFields: string[];
}

export interface ExemptedProperty {
  id: string;
  address: string;
  exemptionReason: string;
}

export interface QualityIssue {
  category: string;
  label: string;
  priority: 'high' | 'medium' | 'low';
  completeCount: number;
  totalCount: number;
  requiredCount: number;
  exemptedCount: number;
  affectedProperties: AffectedProperty[];
  exemptedProperties: ExemptedProperty[];
}

export interface QualityAnalysis {
  overallCompleteness: number;
  completeFields: number;
  totalFields: number;
  requiredFields: number;
  exemptedFields: number;
  issues: QualityIssue[];
}

export type PropertyWithExemptions = PropertyWithFinancials & {
  epc_required?: boolean | null;
  is_grade_listed?: boolean | null;
  listing_grade?: string | null;
  has_gas?: boolean | null;
};
