export type RentStatus = 'upcoming' | 'due' | 'paid' | 'partial' | 'overdue' | 'bad_debt';

export interface RentScheduleItem {
  id: string;
  org_id: string;
  tenancy_id: string;
  agreement_id: string | null;
  due_date: string;
  period_start: string;
  period_end: string;
  rent_amount: number;
  additional_charges: number;
  amount_paid: number;
  amount_outstanding: number;
  status: RentStatus;
  reminder_sent_at: string | null;
  warning_sent_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface RentScheduleWithDetails extends RentScheduleItem {
  // V2 agreement join (preferred when agreement_id is set)
  agreement: {
    id: string;
    rent_amount_pcm: number;
    status: string;
    start_date: string;
    tenant: {
      id: string;
      first_name: string;
      last_name: string;
      tenant_type: string;
      email: string | null;
      phone: string | null;
    };
    room: {
      id: string;
      room_name: string;
    };
    property: {
      id: string;
      address_line_1: string;
      city: string;
      postcode: string;
    };
  } | null;
  // V1 tenancy join (fallback when agreement_id is null)
  tenancy: {
    id: string;
    tenant: {
      id: string;
      first_name: string;
      last_name: string;
      tenant_type?: string;
      company_name?: string | null;
      email?: string | null;
      phone?: string | null;
    };
    room: {
      room_name: string;
    };
    property: {
      id: string;
      address_line: string;
      town_city: string | null;
      postcode: string | null;
    };
  } | null;
}

/**
 * Normalize V1 tenancy join OR V2 agreement join into a common display shape.
 * All UI components use this — they never access .tenancy or .agreement directly.
 */
export interface RentItemDisplay {
  tenantName: string;
  tenantEmail: string | null;
  tenantPhone: string | null;
  tenantId: string;
  roomName: string;
  roomId: string | null;
  propertyId: string;
  propertyAddress: string;
  propertyPostcode: string | null;
  tenancyId: string;
  agreementId: string | null;
}

export interface RentPayment {
  id: string;
  org_id: string;
  tenancy_id: string;
  agreement_id?: string | null;
  rent_schedule_id: string | null;
  amount: number;
  payment_date: string;
  payment_method: string | null;
  reference: string | null;
  is_reconciled: boolean;
  notes: string | null;
  recorded_by: string | null;
  created_at: string;
}

export interface RentScheduleNotesUpdate {
  notes?: string;
  tags?: string[];
}

export interface ArrearsAgingRow {
  property_id: string;
  property_address: string;
  property_postcode: string | null;
  bucket_30: number;
  bucket_60: number;
  bucket_90: number;
  bucket_more: number;
  total: number;
  tenancies: {
    tenancy_id: string;
    tenant_name: string;
    room_name: string;
    bucket_30: number;
    bucket_60: number;
    bucket_90: number;
    bucket_more: number;
    total: number;
    schedule_items: RentScheduleWithDetails[];
  }[];
}

export interface MonthSummaryData {
  totalOverdue: number;
  dueToday: number;
  thisMonthExpected: number;
  thisMonthCollected: number;
  nextMonthExpected: number;
}

export interface LedgerEntry {
  id: string;
  date: string;
  type: 'rent' | 'payment';
  description: string;
  status: RentStatus | 'payment' | null;
  amount: number;
  running_balance: number;
  rent_schedule_id: string | null;
  payment_id: string | null;
  is_future: boolean;
}

export interface RentTrendPoint {
  month: string;
  label: string;
  due: number;
  paid: number;
  outstanding: number;
}

// Shared select fragment for dual V1/V2 joins
export const RENT_SCHEDULE_SELECT = `
  id, org_id, tenancy_id, agreement_id, due_date, period_start, period_end,
  rent_amount, additional_charges, amount_paid, amount_outstanding, status,
  reminder_sent_at, warning_sent_at, notes, created_at, updated_at, payment_reference, tags,
  agreement:tenancy_agreements(
    id,
    rent_amount_pcm,
    status,
    start_date,
    tenant:tenants_v2(id, first_name, last_name, tenant_type, email, phone),
    room:rooms_v2(id, room_name),
    property:properties_v2(id, address_line_1, city, postcode)
  ),
  tenancy:tenancies(
    id,
    tenant:tenants(id, first_name, last_name, tenant_type, company_name, email, phone),
    room:rooms(room_name),
    property:properties(id, address_line, town_city, postcode)
  )
`;
