// Types for the Financial Snapshots module

export interface FinancialSnapshot {
  id: string;
  org_id: string;
  property_id: string;
  entity_id: string;
  snapshot_month: string; // date as string, always first of month
  gross_rent_due: number;
  gross_rent_received: number;
  void_loss: number;
  management_fees: number;
  maintenance_costs: number;
  insurance_costs: number;
  mortgage_payments: number;
  utilities: number;
  council_tax: number;
  licensing_costs: number;
  professional_fees: number;
  other_costs: number;
  other_income: number;
  total_costs: number;
  net_operating_income: number;
  net_cash_flow: number;
  occupancy_rate: number | null;
  rent_collection_rate: number;
  notes: string | null;
  is_locked: boolean;
  locked_at: string | null;
  locked_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PortfolioMonthlySummary {
  org_id: string;
  snapshot_month: string;
  property_count: number;
  total_rent_due: number;
  total_rent_received: number;
  total_void_loss: number;
  total_costs: number;
  total_mortgage_payments: number;
  total_noi: number;
  total_cash_flow: number;
  portfolio_collection_rate: number;
  avg_occupancy_rate: number | null;
}

export interface EntityFinancialSummary {
  org_id: string;
  entity_id: string;
  entity_name: string;
  entity_type: string;
  snapshot_month: string;
  property_count: number;
  total_rent_received: number;
  total_costs: number;
  total_mortgage_payments: number;
  total_noi: number;
  total_cash_flow: number;
}

export interface PropertyAnnualPerformance {
  org_id: string;
  property_id: string;
  property_address: string;
  entity_name: string;
  current_valuation: number | null;
  purchase_price: number | null;
  annual_rent_received: number;
  annual_costs: number;
  annual_mortgage_payments: number;
  annual_noi: number;
  annual_cash_flow: number;
  avg_occupancy: number | null;
  avg_collection_rate: number | null;
  net_yield_pct: number | null;
  cash_on_cash_return_pct: number | null;
}

export interface SnapshotEntryValues {
  gross_rent_due: number;
  gross_rent_received: number;
  void_loss: number;
  other_income: number;
  management_fees: number;
  maintenance_costs: number;
  insurance_costs: number;
  mortgage_payments: number;
  utilities: number;
  council_tax: number;
  licensing_costs: number;
  professional_fees: number;
  other_costs: number;
  occupancy_rate: number | null;
  notes: string;
}

export interface SnapshotAutoSuggestions {
  gross_rent_due: number;
  mortgage_payments: number;
  void_loss: number;
  occupancy_rate: number;
}
