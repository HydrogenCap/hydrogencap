// ============================================
// PROPERTIES TABLE CONFIGURATION
// Column definitions, view presets, and types
// ============================================

export type ViewPreset = 'default' | 'finance' | 'risk' | 'ops';
export type SortDirection = 'asc' | 'desc';

// All available columns with their labels
export const ALL_COLUMNS = [
  { key: 'select', label: 'Select' },
  { key: 'photo', label: 'Photo' },
  { key: 'lifecycle', label: 'Status' },
  { key: 'address', label: 'Property Address' },
  { key: 'area', label: 'Area' },
  { key: 'ownership', label: 'Ownership' },
  { key: 'propertyType', label: 'Property Type' },
  { key: 'beds', label: 'Beds' },
  { key: 'value', label: 'Property Value' },
  { key: 'purchasePrice', label: 'Purchase Price' },
  { key: 'purchaseDate', label: 'Original Purchase Date' },
  { key: 'lender', label: 'Lender' },
  { key: 'interestRate', label: 'Interest Rate' },
  { key: 'fixedOrVariable', label: 'Fixed or Variable' },
  { key: 'mortgageType', label: 'Mortgage Type' },
  { key: 'capitalOrInterest', label: 'Capital / Interest' },
  { key: 'fixedRateExpires', label: 'Fixed Rate Expires' },
  { key: 'insuranceExpire', label: 'Insurance Expire' },
  { key: 'mortgageBalance', label: 'Current Mortgage Balance' },
  { key: 'mortgagePayment', label: 'Mortgage' },
  { key: 'rentalIncome', label: 'Rental Income' },
  { key: 'billsManagement', label: 'Bills & Management' },
  { key: 'netRent', label: 'Net Rent' },
  { key: 'yield', label: 'Yield' },
  { key: 'ltv', label: 'LTV' },
  { key: 'equity', label: 'Equity' },
  // Additional columns for specific views
  { key: 'epc', label: 'EPC' },
  { key: 'monthlyCashflow', label: 'Monthly Cashflow' },
  { key: 'riskStatus', label: 'Risk Status' },
  { key: 'keysafeCode', label: 'Keysafe Code' },
  { key: 'waterStopTap', label: 'Water Stop Tap' },
  { key: 'electricMeter', label: 'Electric Meter' },
  { key: 'gasMeter', label: 'Gas Meter' },
  { key: 'waterMeter', label: 'Water Meter' },
  { key: 'constructionDateBand', label: 'Construction' },
  { key: 'hmoLicenceNumber', label: 'HMO Licence #' },
  { key: 'hmoLicenceExpiry', label: 'HMO Licence Expiry' },
  { key: 'managementCompany', label: 'Management Company' },
  { key: 'actions', label: 'Actions' },
] as const;

export type ColumnKey = typeof ALL_COLUMNS[number]['key'];

// Preset configurations
export const VIEW_PRESETS: Record<ViewPreset, { label: string; columns: ColumnKey[]; defaultSort?: ColumnKey; sortDir?: SortDirection }> = {
  default: {
    label: 'Default (Sheet View)',
    columns: [
      'select', 'photo', 'lifecycle', 'address', 'area', 'ownership', 'propertyType', 'beds', 'value', 'purchasePrice',
      'purchaseDate', 'lender', 'interestRate', 'fixedOrVariable', 'mortgageType', 'capitalOrInterest',
      'fixedRateExpires', 'insuranceExpire', 'mortgageBalance', 'mortgagePayment', 'rentalIncome',
      'billsManagement', 'netRent', 'yield', 'ltv', 'equity'
    ],
    defaultSort: 'address',
    sortDir: 'asc',
  },
  finance: {
    label: 'Finance View',
    columns: [
      'select', 'photo', 'lifecycle', 'address', 'area', 'ownership', 'beds', 'value', 'mortgageBalance', 'mortgagePayment',
      'interestRate', 'fixedOrVariable', 'mortgageType', 'capitalOrInterest', 'rentalIncome',
      'billsManagement', 'netRent', 'yield', 'ltv', 'equity'
    ],
    defaultSort: 'equity',
    sortDir: 'desc',
  },
  risk: {
    label: 'Risk View',
    columns: [
      'select', 'photo', 'lifecycle', 'address', 'area', 'lender', 'ltv', 'fixedRateExpires', 'insuranceExpire',
      'epc', 'monthlyCashflow', 'netRent', 'riskStatus'
    ],
    defaultSort: 'riskStatus',
    sortDir: 'desc',
  },
  ops: {
    label: 'Ops View',
    columns: [
      'select', 'photo', 'lifecycle', 'address', 'area', 'keysafeCode', 'waterStopTap', 'electricMeter', 'gasMeter',
      'waterMeter', 'constructionDateBand', 'hmoLicenceNumber', 'hmoLicenceExpiry', 'managementCompany'
    ],
    defaultSort: 'address',
    sortDir: 'asc',
  },
};

// Default visible columns for the default view
export const DEFAULT_VISIBLE_COLUMNS = new Set<ColumnKey>([
  'select', 'photo', 'lifecycle', 'address', 'area', 'ownership', 'propertyType', 'beds', 'value', 'purchasePrice',
  'lender', 'interestRate', 'fixedRateExpires', 'mortgageBalance', 'mortgagePayment',
  'rentalIncome', 'netRent', 'yield', 'ltv', 'equity', 'actions'
]);

// Filter label mapping
export const FILTER_LABELS: Record<string, string> = {
  rate_expiry_3m: 'Fixed rate expiring in 3 months',
  rate_expiry_6m: 'Fixed rate expiring in 6 months',
  rate_expiry_12m: 'Fixed rate expiring in 12 months',
  ltv_above_75: 'LTV above 75%',
  ltv_above_85: 'LTV above 85%',
  epc_below_c: 'EPC below C rating',
  negative_cashflow: 'Negative cashflow',
  missing_passport: 'Missing passport data',
};
