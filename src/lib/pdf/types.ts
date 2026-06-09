import type { Color } from '@/types/pdf';

export interface ReportFilters {
  lifecycleType: 'core_rental' | 'development' | 'all';
  propertyIds: string[] | 'all';
  asOfDate: Date;
  includeAttachments: boolean;
}

export interface ComplianceItemData {
  id: string;
  compliance_type: string;
  issue_date: string | null;
  expiry_date: string | null;
  is_required: boolean | null;
  is_manually_excluded: boolean | null;
  documents?: { file_url: string; original_file_name: string }[];
}

export interface PropertyReportData {
  id: string;
  address_line: string;
  postcode: string | null;
  lifecycle_type: string;
  tenure: string | null;
  beds: number | null;
  bathrooms: number | null;
  property_type: string | null;
  area_name: string | null;
  current_value_gbp: number | null;
  purchase_price_gbp: number | null;
  original_purchase_date: string | null;
  epc_rating: string | null;
  is_hmo_licensed: boolean | null;
  asset_category: string | null;
  legal_owner_company_id: string | null;
  complianceItems: ComplianceItemData[];
  loans?: { lender: string | null; current_mortgage_balance_gbp: number | null; interest_rate_percent: number | null; fixed_rate_expires: string | null; capital_or_interest: string | null }[];
  income?: { annual_rent_gbp: number; year: number }[];
  passport?: {
    construction_date_band: string | null;
    council_tax_band: string | null;
    local_authority_text: string | null;
  } | null;
  insurancePolicy?: {
    insurer_name: string | null;
    policy_number: string | null;
    renewal_date: string | null;
    premium_gbp: number | null;
  } | null;
  ownerName?: string;
}

export type { Color };
