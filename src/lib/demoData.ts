/**
 * AE2: Demo Portfolio Seed Data
 * Static definitions for 3 realistic UK properties with supporting data.
 * All notes fields prefixed with '[DEMO]' for identification.
 */

import { format, subMonths, subDays, addMonths, addDays } from 'date-fns';

const DEMO_TAG = '[DEMO]';
const now = new Date();

// Helper: date string
const d = (date: Date) => format(date, 'yyyy-MM-dd');

export interface DemoEntity {
  entity_name: string;
  entity_type: string;
  company_number?: string;
  notes: string;
  is_group_parent?: boolean;
}

export const DEMO_ENTITIES: DemoEntity[] = [
  {
    entity_name: 'Cheltenham Properties Ltd',
    entity_type: 'spv',
    company_number: '12345678',
    notes: `${DEMO_TAG} Demo SPV entity`,
    is_group_parent: true,
  },
  {
    entity_name: 'Personal',
    entity_type: 'personal',
    notes: `${DEMO_TAG} Personal entity for single lets`,
  },
];

export interface DemoProperty {
  address_line_1: string;
  city: string;
  postcode: string;
  country: string;
  property_type: string;
  lifecycle_stage: string;
  has_gas_supply: boolean;
  year_built: number;
  total_floors: number;
  total_lettable_rooms: number;
  purchase_date: string;
  purchase_price: number;
  current_valuation: number;
  valuation_date: string;
  notes: string;
  is_demo: boolean;
  entity_index: number; // index into DEMO_ENTITIES
  latitude: number;
  longitude: number;
}

export const DEMO_PROPERTIES: DemoProperty[] = [
  {
    address_line_1: '14 High Street',
    city: 'Cheltenham',
    postcode: 'GL50 1DZ',
    country: 'England',
    property_type: 'hmo_licensed',
    lifecycle_stage: 'stabilised',
    has_gas_supply: true,
    year_built: 1920,
    total_floors: 3,
    total_lettable_rooms: 5,
    purchase_date: '2022-06-15',
    purchase_price: 185000,
    current_valuation: 240000,
    valuation_date: d(subMonths(now, 3)),
    notes: `${DEMO_TAG} 5-bed licensed HMO in Cheltenham town centre`,
    is_demo: true,
    entity_index: 0,
    latitude: 51.8994,
    longitude: -2.0783,
  },
  {
    address_line_1: '8 Oak Road',
    city: 'Oxford',
    postcode: 'OX1 3QR',
    country: 'England',
    property_type: 'single_let',
    lifecycle_stage: 'stabilised',
    has_gas_supply: true,
    year_built: 1965,
    total_floors: 2,
    total_lettable_rooms: 1,
    purchase_date: '2021-03-20',
    purchase_price: 320000,
    current_valuation: 365000,
    valuation_date: d(subMonths(now, 6)),
    notes: `${DEMO_TAG} Single let in Oxford`,
    is_demo: true,
    entity_index: 1,
    latitude: 51.7520,
    longitude: -1.2577,
  },
  {
    address_line_1: '22 Elm Avenue',
    city: 'Bristol',
    postcode: 'BS1 5TH',
    country: 'England',
    property_type: 'hmo_mandatory',
    lifecycle_stage: 'refurbishment',
    has_gas_supply: true,
    year_built: 1935,
    total_floors: 3,
    total_lettable_rooms: 7,
    purchase_date: '2025-01-10',
    purchase_price: 275000,
    current_valuation: 275000,
    valuation_date: '2025-01-10',
    notes: `${DEMO_TAG} HMO refurbishment project in Bristol`,
    is_demo: true,
    entity_index: 0,
    latitude: 51.4545,
    longitude: -2.5879,
  },
];

export interface DemoRoom {
  room_name: string;
  room_type: string;
  floor: number;
  has_ensuite: boolean;
  is_lettable: boolean;
  target_rent_pcm: number | null;
  notes: string;
  property_index: number;
}

export const DEMO_ROOMS: DemoRoom[] = [
  // Property 1 — 14 High Street (5 lettable + 2 communal)
  { room_name: 'Room 1', room_type: 'double', floor: 0, has_ensuite: false, is_lettable: true, target_rent_pcm: 550, notes: `${DEMO_TAG}`, property_index: 0 },
  { room_name: 'Room 2', room_type: 'double', floor: 0, has_ensuite: false, is_lettable: true, target_rent_pcm: 550, notes: `${DEMO_TAG}`, property_index: 0 },
  { room_name: 'Room 3', room_type: 'double', floor: 1, has_ensuite: true, is_lettable: true, target_rent_pcm: 625, notes: `${DEMO_TAG}`, property_index: 0 },
  { room_name: 'Room 4', room_type: 'double', floor: 1, has_ensuite: false, is_lettable: true, target_rent_pcm: 500, notes: `${DEMO_TAG}`, property_index: 0 },
  { room_name: 'Room 5', room_type: 'single', floor: 2, has_ensuite: false, is_lettable: true, target_rent_pcm: 475, notes: `${DEMO_TAG}`, property_index: 0 },
  { room_name: 'Kitchen', room_type: 'communal', floor: 0, has_ensuite: false, is_lettable: false, target_rent_pcm: null, notes: `${DEMO_TAG}`, property_index: 0 },
  { room_name: 'Lounge', room_type: 'communal', floor: 0, has_ensuite: false, is_lettable: false, target_rent_pcm: null, notes: `${DEMO_TAG}`, property_index: 0 },
  // Property 2 — 8 Oak Road (1 whole property)
  { room_name: 'Whole Property', room_type: 'whole_property', floor: 0, has_ensuite: false, is_lettable: true, target_rent_pcm: 1200, notes: `${DEMO_TAG}`, property_index: 1 },
  // Property 3 — 22 Elm Avenue (7 lettable + 3 communal)
  { room_name: 'Room 1', room_type: 'double', floor: 0, has_ensuite: false, is_lettable: true, target_rent_pcm: 525, notes: `${DEMO_TAG}`, property_index: 2 },
  { room_name: 'Room 2', room_type: 'double', floor: 0, has_ensuite: false, is_lettable: true, target_rent_pcm: 525, notes: `${DEMO_TAG}`, property_index: 2 },
  { room_name: 'Room 3', room_type: 'double', floor: 1, has_ensuite: true, is_lettable: true, target_rent_pcm: 600, notes: `${DEMO_TAG}`, property_index: 2 },
  { room_name: 'Room 4', room_type: 'double', floor: 1, has_ensuite: false, is_lettable: true, target_rent_pcm: 500, notes: `${DEMO_TAG}`, property_index: 2 },
  { room_name: 'Room 5', room_type: 'single', floor: 2, has_ensuite: false, is_lettable: true, target_rent_pcm: 475, notes: `${DEMO_TAG}`, property_index: 2 },
  { room_name: 'Room 6', room_type: 'double', floor: 2, has_ensuite: true, is_lettable: true, target_rent_pcm: 600, notes: `${DEMO_TAG}`, property_index: 2 },
  { room_name: 'Room 7', room_type: 'single', floor: 2, has_ensuite: false, is_lettable: true, target_rent_pcm: 450, notes: `${DEMO_TAG}`, property_index: 2 },
  { room_name: 'Kitchen', room_type: 'communal', floor: 0, has_ensuite: false, is_lettable: false, target_rent_pcm: null, notes: `${DEMO_TAG}`, property_index: 2 },
  { room_name: 'Lounge', room_type: 'communal', floor: 0, has_ensuite: false, is_lettable: false, target_rent_pcm: null, notes: `${DEMO_TAG}`, property_index: 2 },
  { room_name: 'Dining Room', room_type: 'communal', floor: 0, has_ensuite: false, is_lettable: false, target_rent_pcm: null, notes: `${DEMO_TAG}`, property_index: 2 },
];

export interface DemoTenant {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  notes: string;
  // Tenancy details
  property_index: number;
  room_index: number; // index into rooms for that property
  rent_amount_pcm: number;
  start_date: string;
  is_periodic?: boolean;
  break_clause_date?: string;
}

export const DEMO_TENANTS: DemoTenant[] = [
  {
    first_name: 'James', last_name: 'Wilson', email: 'james.wilson@example.com', phone: '07700100001',
    notes: `${DEMO_TAG}`, property_index: 0, room_index: 0, rent_amount_pcm: 550, start_date: '2024-09-01',
  },
  {
    first_name: 'Sarah', last_name: 'Chen', email: 'sarah.chen@example.com', phone: '07700100002',
    notes: `${DEMO_TAG}`, property_index: 0, room_index: 1, rent_amount_pcm: 550, start_date: '2024-11-01',
  },
  {
    first_name: 'Marcus', last_name: 'Johnson', email: 'marcus.johnson@example.com', phone: '07700100003',
    notes: `${DEMO_TAG}`, property_index: 0, room_index: 2, rent_amount_pcm: 625, start_date: '2024-08-01',
    break_clause_date: d(addMonths(now, 2)),
  },
  {
    first_name: 'Priya', last_name: 'Patel', email: 'priya.patel@example.com', phone: '07700100004',
    notes: `${DEMO_TAG}`, property_index: 0, room_index: 4, rent_amount_pcm: 475, start_date: '2025-01-01',
  },
  {
    first_name: 'Tom', last_name: 'Davis', email: 'tom.davis@example.com', phone: '07700100005',
    notes: `${DEMO_TAG}`, property_index: 1, room_index: 0, rent_amount_pcm: 1200, start_date: '2023-04-01',
    is_periodic: true,
  },
];

export interface DemoLender {
  lender_name: string;
  lender_type: string;
  notes: string;
}

export const DEMO_LENDERS: DemoLender[] = [
  { lender_name: 'ABC Mortgages', lender_type: 'specialist', notes: `${DEMO_TAG}` },
  { lender_name: 'Natwest', lender_type: 'high_street', notes: `${DEMO_TAG}` },
  { lender_name: 'Bridging Finance Co', lender_type: 'bridging', notes: `${DEMO_TAG}` },
];

export interface DemoLoan {
  property_index: number;
  entity_index: number;
  lender_index: number;
  facility_type: string;
  original_amount: number;
  current_balance: number;
  interest_rate: number;
  rate_type: string;
  monthly_payment: number;
  term_start_date: string;
  term_end_date: string;
  repayment_type: string;
  rate_expiry_date?: string;
  notes: string;
}

export const DEMO_LOANS: DemoLoan[] = [
  {
    property_index: 0, entity_index: 0, lender_index: 0,
    facility_type: 'term_mortgage', original_amount: 148000, current_balance: 148000,
    interest_rate: 5.49, rate_type: 'fixed', monthly_payment: 732,
    term_start_date: '2022-06-15', term_end_date: '2047-06-15',
    repayment_type: 'interest_only', rate_expiry_date: '2027-06-15',
    notes: `${DEMO_TAG}`,
  },
  {
    property_index: 1, entity_index: 1, lender_index: 1,
    facility_type: 'term_mortgage', original_amount: 224000, current_balance: 224000,
    interest_rate: 4.89, rate_type: 'variable', monthly_payment: 1180,
    term_start_date: '2021-03-20', term_end_date: '2046-03-20',
    repayment_type: 'interest_only',
    notes: `${DEMO_TAG}`,
  },
  {
    property_index: 2, entity_index: 0, lender_index: 2,
    facility_type: 'bridging_loan', original_amount: 220000, current_balance: 220000,
    interest_rate: 0.85, rate_type: 'fixed', monthly_payment: 1870,
    term_start_date: '2025-01-10', term_end_date: d(addMonths(now, 6)),
    repayment_type: 'rolled_up',
    notes: `${DEMO_TAG}`,
  },
];

export interface DemoCompliance {
  property_index: number;
  document_type: string;
  issue_date: string;
  expiry_date: string | null;
  status: string;
  notes: string;
}

export const DEMO_COMPLIANCE_REQS: {
  property_index: number;
  document_type: string;
  is_required: boolean;
  review_frequency_months: number | null;
  lead_time_days: number;
  requirement_reason: string;
  notes: string;
}[] = [
  // Property 1 - full set
  { property_index: 0, document_type: 'gas_safety_certificate', is_required: true, review_frequency_months: 12, lead_time_days: 30, requirement_reason: 'has_gas_supply', notes: `${DEMO_TAG}` },
  { property_index: 0, document_type: 'epc', is_required: true, review_frequency_months: 120, lead_time_days: 14, requirement_reason: 'all_properties', notes: `${DEMO_TAG}` },
  { property_index: 0, document_type: 'eicr', is_required: true, review_frequency_months: 60, lead_time_days: 30, requirement_reason: 'all_properties', notes: `${DEMO_TAG}` },
  { property_index: 0, document_type: 'fire_risk_assessment', is_required: true, review_frequency_months: 12, lead_time_days: 30, requirement_reason: 'hmo', notes: `${DEMO_TAG}` },
  { property_index: 0, document_type: 'hmo_licence', is_required: true, review_frequency_months: 60, lead_time_days: 60, requirement_reason: 'hmo_licensed', notes: `${DEMO_TAG}` },
  // Property 2
  { property_index: 1, document_type: 'gas_safety_certificate', is_required: true, review_frequency_months: 12, lead_time_days: 30, requirement_reason: 'has_gas_supply', notes: `${DEMO_TAG}` },
  { property_index: 1, document_type: 'epc', is_required: true, review_frequency_months: 120, lead_time_days: 14, requirement_reason: 'all_properties', notes: `${DEMO_TAG}` },
  { property_index: 1, document_type: 'eicr', is_required: true, review_frequency_months: 60, lead_time_days: 30, requirement_reason: 'all_properties', notes: `${DEMO_TAG}` },
  // Property 3 - only buildings insurance
  { property_index: 2, document_type: 'buildings_insurance', is_required: true, review_frequency_months: 12, lead_time_days: 30, requirement_reason: 'all_properties', notes: `${DEMO_TAG}` },
];

export const DEMO_COMPLIANCE_DOCS: DemoCompliance[] = [
  // Property 1
  { property_index: 0, document_type: 'gas_safety_certificate', issue_date: d(subMonths(now, 4)), expiry_date: d(addMonths(now, 8)), status: 'valid', notes: `${DEMO_TAG}` },
  { property_index: 0, document_type: 'epc', issue_date: '2022-05-01', expiry_date: '2032-05-01', status: 'valid', notes: `${DEMO_TAG} EPC rating C` },
  { property_index: 0, document_type: 'eicr', issue_date: d(subMonths(now, 18)), expiry_date: d(addMonths(now, 42)), status: 'valid', notes: `${DEMO_TAG}` },
  { property_index: 0, document_type: 'fire_risk_assessment', issue_date: d(subMonths(now, 11)), expiry_date: d(addDays(now, 45)), status: 'valid', notes: `${DEMO_TAG} Expiring soon` },
  { property_index: 0, document_type: 'hmo_licence', issue_date: '2023-01-15', expiry_date: '2028-01-15', status: 'valid', notes: `${DEMO_TAG}` },
  // Property 2
  { property_index: 1, document_type: 'gas_safety_certificate', issue_date: d(subMonths(now, 6)), expiry_date: d(addMonths(now, 6)), status: 'valid', notes: `${DEMO_TAG}` },
  { property_index: 1, document_type: 'epc', issue_date: '2021-02-01', expiry_date: '2031-02-01', status: 'valid', notes: `${DEMO_TAG} EPC rating D - consider improvements` },
  { property_index: 1, document_type: 'eicr', issue_date: d(subMonths(now, 62)), expiry_date: d(subMonths(now, 2)), status: 'expired', notes: `${DEMO_TAG} EXPIRED — requires immediate renewal` },
  // Property 3
  { property_index: 2, document_type: 'buildings_insurance', issue_date: '2025-01-10', expiry_date: '2026-01-10', status: 'valid', notes: `${DEMO_TAG}` },
];

export interface DemoVoid {
  property_index: number;
  room_index: number;
  start_date: string;
  reason: string;
  estimated_monthly_cost: number;
  notes: string;
}

export const DEMO_VOIDS: DemoVoid[] = [
  {
    property_index: 0,
    room_index: 3, // Room 4
    start_date: d(subDays(now, 21)),
    reason: 'between_tenants',
    estimated_monthly_cost: 500,
    notes: `${DEMO_TAG} Room 4 void — marketing in progress`,
  },
];

export interface DemoMaintenance {
  property_index: number;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  reported_date: string;
  notes: string;
}

export const DEMO_MAINTENANCE: DemoMaintenance[] = [
  {
    property_index: 0,
    title: 'Dripping kitchen tap',
    description: 'Kitchen cold tap dripping constantly. Washer likely needs replacing.',
    category: 'plumbing',
    priority: 'normal',
    status: 'scheduled',
    reported_date: d(subDays(now, 5)),
    notes: `${DEMO_TAG} Plumber booked for next week`,
  },
  {
    property_index: 0,
    title: 'Damp patch in Room 2',
    description: 'Tenant reports damp patch on external wall of Room 2. Approximately 30cm diameter.',
    category: 'damp_mould',
    priority: 'urgent',
    status: 'new',
    reported_date: d(subDays(now, 2)),
    notes: `${DEMO_TAG} Needs urgent inspection`,
  },
];
