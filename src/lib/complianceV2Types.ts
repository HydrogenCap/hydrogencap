// ============================================================
// Compliance v2 — Types, constants, and display mappings
// ============================================================

/** Database enum values for compliance document types */
export const COMPLIANCE_DOC_TYPES = [
  'gas_safety_certificate',
  'epc',
  'eicr',
  'fire_risk_assessment',
  'hmo_licence',
  'selective_licence',
  'buildings_insurance',
  'rent_guarantee_insurance',
  'legionella_risk_assessment',
  'asbestos_survey',
  'pat_testing',
  'emergency_lighting_cert',
  'fire_alarm_cert',
  'smoke_co_alarm_cert',
  'furniture_fire_safety',
  'energy_performance_certificate',
  'planning_permission',
  'building_regs_completion',
  'other',
] as const;

export type ComplianceDocType = typeof COMPLIANCE_DOC_TYPES[number];

/** Compliance status union */
export type ComplianceStatusV2 =
  | 'valid'
  | 'expiring_soon'
  | 'critical'
  | 'expired'
  | 'missing'
  | 'not_required';

/** Human-readable display names — never show DB values to users */
export const DOC_TYPE_DISPLAY_NAMES: Record<ComplianceDocType, string> = {
  gas_safety_certificate: 'Gas Safety Certificate (CP12)',
  epc: 'Energy Performance Certificate (EPC)',
  eicr: 'Electrical Installation Condition Report (EICR)',
  fire_risk_assessment: 'Fire Risk Assessment',
  hmo_licence: 'HMO Licence',
  selective_licence: 'Selective Licence',
  buildings_insurance: 'Buildings Insurance',
  
  rent_guarantee_insurance: 'Rent Guarantee Insurance',
  legionella_risk_assessment: 'Legionella Risk Assessment',
  asbestos_survey: 'Asbestos Survey',
  pat_testing: 'PAT Testing',
  emergency_lighting_cert: 'Emergency Lighting Certificate',
  fire_alarm_cert: 'Fire Alarm Certificate',
  smoke_co_alarm_cert: 'Smoke & CO Alarm Certificate',
  furniture_fire_safety: 'Furniture Fire Safety',
  energy_performance_certificate: 'Energy Performance Certificate',
  planning_permission: 'Planning Permission',
  building_regs_completion: 'Building Regs Completion',
  other: 'Other Document',
};

/** Column order for the compliance matrix grid */
export const MATRIX_COLUMN_ORDER: ComplianceDocType[] = [
  'gas_safety_certificate',
  'epc',
  'eicr',
  'fire_risk_assessment',
  'hmo_licence',
  'selective_licence',
  'buildings_insurance',
  
  'emergency_lighting_cert',
  'fire_alarm_cert',
  'smoke_co_alarm_cert',
  'pat_testing',
  'legionella_risk_assessment',
  'asbestos_survey',
  'furniture_fire_safety',
  'rent_guarantee_insurance',
];

/** Short labels for matrix column headers */
export const DOC_TYPE_SHORT_LABELS: Record<ComplianceDocType, string> = {
  gas_safety_certificate: 'Gas',
  epc: 'EPC',
  eicr: 'EICR',
  fire_risk_assessment: 'FRA',
  hmo_licence: 'HMO',
  selective_licence: 'Sel. Lic',
  buildings_insurance: 'Bldg Ins',
  
  rent_guarantee_insurance: 'RG Ins',
  legionella_risk_assessment: 'Legionella',
  asbestos_survey: 'Asbestos',
  pat_testing: 'PAT',
  emergency_lighting_cert: 'Em. Light',
  fire_alarm_cert: 'Fire Alarm',
  smoke_co_alarm_cert: 'Smoke/CO',
  furniture_fire_safety: 'Furn. Fire',
  energy_performance_certificate: 'EPC',
  planning_permission: 'Planning',
  building_regs_completion: 'Bldg Regs',
  other: 'Other',
};

/** Suggested "not required" reasons per document type. Free text is also allowed. */
export const NOT_REQUIRED_REASON_PRESETS: Partial<Record<ComplianceDocType, string[]>> = {
  hmo_licence: ['Not an HMO', 'Below local HMO threshold', 'Property unoccupied'],
  selective_licence: ['Not in a selective licensing area', 'Property unoccupied'],
  gas_safety_certificate: ['No gas supply', 'All-electric property'],
  eicr: ['Recently rewired — next due > 5 years', 'Commercial unit'],
  epc: ['Listed building exemption', 'Commercial unit'],
  fire_risk_assessment: ['Single dwelling — not a common-parts FRA required', 'Owner-occupied'],
  emergency_lighting_cert: ['No common parts requiring emergency lighting', 'Not an HMO'],
  fire_alarm_cert: ['Domestic smoke alarms only — no Grade A/D system fitted', 'Not an HMO'],
  smoke_co_alarm_cert: ['Battery-only domestic alarms (not certified system)', 'Annual landlord test logged elsewhere'],
  pat_testing: ['No landlord-supplied appliances', 'Furnished by tenant'],
  legionella_risk_assessment: ['Mains-fed only, no stored water', 'Risk assessment held by management company'],
  asbestos_survey: ['Built post-2000', 'Survey held by freeholder'],
  furniture_fire_safety: ['Unfurnished let', 'No upholstered furniture supplied'],
  rent_guarantee_insurance: ['Self-insured', 'Corporate tenant'],
  buildings_insurance: ['Covered under block / freeholder policy'],
};

/** Row shape from the compliance_matrix_v2 view */
export interface ComplianceMatrixRow {
  requirement_id: string;
  org_id: string;
  property_id: string;
  property_address: string;
  property_type: string;
  entity_name: string | null;
  document_type: ComplianceDocType;
  is_required: boolean;
  override_reason: string | null;
  review_frequency_months: number | null;
  lead_time_days: number | null;
  document_id: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  issuer_name: string | null;
  certificate_number: string | null;
  file_url: string | null;
  ai_extracted: boolean | null;
  cost: number | null;
  document_notes: string | null;
  calculated_status: ComplianceStatusV2;
  days_remaining: number | null;
  urgency_score: number;
}

/** Row shape from portfolio_compliance_score_v2 view */
export interface PortfolioComplianceScore {
  total_required: number;
  total_valid: number;
  total_expiring_soon: number;
  total_critical: number;
  total_expired: number;
  total_missing: number;
  compliance_score_pct: number;
}
