// Types for the Accounting Export module (Phase 2.7)

export type AccountingSystem = 'xero' | 'quickbooks' | 'freeagent' | 'sage' | 'generic';

export type ExportType =
  | 'income_transactions'
  | 'expense_transactions'
  | 'combined_journal'
  | 'bank_reconciliation'
  | 'rent_schedule'
  | 'tax_summary'
  | 'full_package';

export type FileFormat = 'csv' | 'xlsx' | 'json' | 'qif' | 'ofx';

export type TaxYearLabel = string; // e.g. "2025/26"

export type HydrogencapCategory =
  | 'gross_rent_received'
  | 'other_income'
  | 'management_fees'
  | 'maintenance_costs'
  | 'insurance_costs'
  | 'mortgage_payments'
  | 'utilities'
  | 'council_tax'
  | 'licensing_costs'
  | 'professional_fees'
  | 'other_costs'
  | 'void_loss';

export interface AccountingMapping {
  id: string;
  org_id: string | null;
  accounting_system: AccountingSystem;
  entity_id: string | null;
  hydrogencap_category: HydrogencapCategory;
  account_code: string;
  account_name: string;
  tax_rate_code: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface AccountingExport {
  id: string;
  org_id: string | null;
  entity_id: string | null;
  export_type: ExportType;
  accounting_system: AccountingSystem;
  period_from: string;
  period_to: string;
  file_url: string | null;
  file_name: string | null;
  file_format: FileFormat;
  row_count: number | null;
  total_income: number | null;
  total_expenses: number | null;
  generated_by: string | null;
  generated_at: string | null;
  notes: string | null;
}

export interface TaxYearSummary {
  id: string;
  org_id: string | null;
  entity_id: string;
  tax_year: TaxYearLabel;
  tax_year_start: string;
  tax_year_end: string;
  total_rental_income: number | null;
  total_other_income: number | null;
  total_mortgage_interest: number | null;
  total_repairs_maintenance: number | null;
  total_insurance: number | null;
  total_management_fees: number | null;
  total_professional_fees: number | null;
  total_utilities: number | null;
  total_council_tax: number | null;
  total_licensing: number | null;
  total_other_expenses: number | null;
  total_allowable_expenses: number | null;
  net_rental_profit: number | null;
  finance_costs: number | null;
  basic_rate_tax_reduction: number | null;
  is_locked: boolean | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ExportConfig {
  exportType: ExportType;
  entityId: string | null; // null = all entities
  periodFrom: string;
  periodTo: string;
  accountingSystem: AccountingSystem;
  fileFormat: FileFormat;
}

export interface TransactionLine {
  date: string;
  amount: number;
  category: HydrogencapCategory;
  accountCode?: string;
  accountName?: string;
  taxRateCode?: string;
  description: string;
  reference: string;
  isExpense?: boolean;
  entityName?: string;
  propertyAddress?: string;
}

export const CATEGORY_LABELS: Record<HydrogencapCategory, string> = {
  gross_rent_received: 'Rental Income',
  other_income: 'Other Income',
  management_fees: 'Management Fees',
  maintenance_costs: 'Repairs & Maintenance',
  insurance_costs: 'Insurance',
  mortgage_payments: 'Finance Costs (Mortgage Interest)',
  utilities: 'Utilities',
  council_tax: 'Council Tax',
  licensing_costs: 'Licensing',
  professional_fees: 'Professional Fees',
  other_costs: 'Other Expenses',
  void_loss: 'Void Loss',
};

export const INCOME_CATEGORIES: HydrogencapCategory[] = [
  'gross_rent_received',
  'other_income',
];

export const EXPENSE_CATEGORIES: HydrogencapCategory[] = [
  'management_fees',
  'maintenance_costs',
  'insurance_costs',
  'mortgage_payments',
  'utilities',
  'council_tax',
  'licensing_costs',
  'professional_fees',
  'other_costs',
  'void_loss',
];

/** Get the UK tax year label for a given date */
export function getTaxYearForDate(date: Date): TaxYearLabel {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  // Tax year runs 6 April – 5 April
  if (month < 4 || (month === 4 && day <= 5)) {
    // In the previous tax year
    const startYear = year - 1;
    return `${startYear}/${String(year).slice(2)}`;
  }
  return `${year}/${String(year + 1).slice(2)}`;
}

/** Get the current UK tax year label */
export function getCurrentTaxYear(): TaxYearLabel {
  return getTaxYearForDate(new Date());
}

/** Parse tax year label to start/end dates */
export function parseTaxYear(label: TaxYearLabel): { start: Date; end: Date } {
  const startYear = parseInt(label.split('/')[0], 10);
  return {
    start: new Date(startYear, 3, 6), // 6 April
    end: new Date(startYear + 1, 3, 5), // 5 April
  };
}

/** Generate list of recent tax years for selector */
export function getRecentTaxYears(count = 5): TaxYearLabel[] {
  const current = getCurrentTaxYear();
  const startYear = parseInt(current.split('/')[0], 10);
  const years: TaxYearLabel[] = [];
  for (let i = 0; i < count; i++) {
    const y = startYear - i;
    years.push(`${y}/${String(y + 1).slice(2)}`);
  }
  return years;
}
