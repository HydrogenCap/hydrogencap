/**
 * Metrics Configuration — shared types
 */
import { PropertyWithFinancials } from '@/hooks/usePropertiesCompat';
import { PropertyPassport } from '@/hooks/usePropertyPassport';

export type MetricKey =
  | 'equity'
  | 'value'
  | 'mortgage'
  | 'debt'
  | 'cashflow'
  | 'rent'
  | 'noi'
  | 'net_yield'
  | 'ltv'
  | 'dscr'
  | 'health'
  | 'risks'
  | 'actions'
  | 'missing_info';

export interface PropertyBreakdownRow {
  propertyId: string;
  address: string;
  entityName?: string | null;
  values: Record<string, string | number | null>;
  fixUrl?: string;
  fixLabel?: string;
}

export interface EntityBreakdownRow {
  entityName: string;
  values: Record<string, string | number | null>;
}

export interface MetricBreakdown {
  title: string;
  summaryValue: string;
  calculationText: string;
  formula: string;
  columns: { key: string; label: string; align?: 'left' | 'right' }[];
  rows: PropertyBreakdownRow[];
  entityRows?: EntityBreakdownRow[];
  entityColumns?: { key: string; label: string; align?: 'left' | 'right' }[];
  totals?: Record<string, string | number>;
  emptyMessage?: string;
}

export interface MetricConfig {
  key: MetricKey;
  title: string;
  description: string;
  icon: string;
  getBreakdown: (
    properties: PropertyWithFinancials[],
    passports: PropertyPassport[]
  ) => MetricBreakdown;
}
