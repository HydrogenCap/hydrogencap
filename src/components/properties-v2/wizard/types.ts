export interface WizardRoom {
  room_name: string;
  room_type: string;
  floor: number;
  has_ensuite: boolean;
  is_lettable: boolean;
  target_rent_pcm: number | null;
}

export interface ComplianceReq {
  document_type: string;
  display_name: string;
  is_required: boolean;
  issue_date: string;
  expiry_date: string;
  certificate_number: string;
  review_frequency_months: number | null;
  lead_time_days: number;
}

export interface WizardData {
  // Step 1: Address
  postcode: string;
  address_line_1: string;
  address_line_2: string;
  city: string;
  county: string;
  country: string;
  // Step 2: Classification
  entity_id: string;
  property_type: string;
  lifecycle_stage: string;
  has_gas_supply: boolean;
  hmo_licence_number: string;
  year_built: string;
  total_floors: string;
  // Step 3: Rooms
  rooms: WizardRoom[];
  // Step 4: Financials
  purchase_date: string;
  purchase_price: string;
  current_valuation: string;
  valuation_date: string;
  stamp_duty: string;
  refurb_costs: string;
  // Mortgage
  has_mortgage: boolean;
  lender_name: string;
  lender_id: string;
  facility_type: string;
  original_amount: string;
  current_balance: string;
  interest_rate: string;
  rate_type: string;
  rate_expiry_date: string;
  monthly_payment: string;
  term_end_date: string;
  ltv_covenant: string;
  // Step 5: Compliance
  compliance_items: ComplianceReq[];
}

export const INITIAL_WIZARD_DATA: WizardData = {
  postcode: '',
  address_line_1: '',
  address_line_2: '',
  city: '',
  county: '',
  country: 'England',
  entity_id: '',
  property_type: 'single_let',
  lifecycle_stage: 'pipeline',
  has_gas_supply: true,
  hmo_licence_number: '',
  year_built: '',
  total_floors: '',
  rooms: [],
  purchase_date: '',
  purchase_price: '',
  current_valuation: '',
  valuation_date: '',
  stamp_duty: '',
  refurb_costs: '',
  has_mortgage: false,
  lender_name: '',
  lender_id: '',
  facility_type: 'term_mortgage',
  original_amount: '',
  current_balance: '',
  interest_rate: '',
  rate_type: 'fixed',
  rate_expiry_date: '',
  monthly_payment: '',
  term_end_date: '',
  ltv_covenant: '',
  compliance_items: [],
};

export const STEP_LABELS = ['Address', 'Classification', 'Rooms', 'Financials', 'Compliance', 'Review'] as const;

export const COMPLIANCE_VALIDITY_MONTHS: Record<string, number> = {
  gas_safety_certificate: 12,
  epc: 120,
  eicr: 60,
  fire_risk_assessment: 12,
  hmo_licence: 60,
  buildings_insurance: 12,
  selective_licence: 60,
  emergency_lighting_cert: 12,
  fire_alarm_cert: 12,
  smoke_co_alarm_cert: 12,
  furniture_fire_safety: 0,
};
