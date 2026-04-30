import { supabaseAny } from '@/integrations/supabase/client';
import { format } from 'date-fns';

// ── Merge field definitions by category ──────────────────────

export interface MergeFieldDefinition {
  key: string;
  label: string;
  category: 'landlord' | 'property' | 'tenant' | 'tenancy' | 'dates';
  sampleValue: string;
}

export const MERGE_FIELD_CATEGORIES = [
  { value: 'landlord', label: 'Landlord / Entity' },
  { value: 'property', label: 'Property' },
  { value: 'tenant', label: 'Tenant' },
  { value: 'tenancy', label: 'Tenancy' },
  { value: 'dates', label: 'Dates' },
] as const;

export const MERGE_FIELDS: MergeFieldDefinition[] = [
  // Landlord / Entity
  { key: 'landlord.name', label: 'Landlord Name', category: 'landlord', sampleValue: 'Acme Properties Ltd' },
  { key: 'landlord.entity_type', label: 'Entity Type', category: 'landlord', sampleValue: 'SPV' },
  { key: 'landlord.company_number', label: 'Company Number', category: 'landlord', sampleValue: '12345678' },
  { key: 'landlord.registered_address', label: 'Registered Address', category: 'landlord', sampleValue: '1 Company House, London EC1A 1BB' },
  { key: 'landlord.vat_number', label: 'VAT Number', category: 'landlord', sampleValue: 'GB123456789' },

  // Property
  { key: 'property.address_line_1', label: 'Address Line 1', category: 'property', sampleValue: '42 Oak Street' },
  { key: 'property.address_line_2', label: 'Address Line 2', category: 'property', sampleValue: 'Flat 3' },
  { key: 'property.city', label: 'City', category: 'property', sampleValue: 'Manchester' },
  { key: 'property.county', label: 'County', category: 'property', sampleValue: 'Greater Manchester' },
  { key: 'property.postcode', label: 'Postcode', category: 'property', sampleValue: 'M1 2AB' },
  { key: 'property.full_address', label: 'Full Address', category: 'property', sampleValue: '42 Oak Street, Manchester, M1 2AB' },
  { key: 'property.type', label: 'Property Type', category: 'property', sampleValue: 'HMO Licensed' },

  // Tenant
  { key: 'tenant.full_name', label: 'Full Name', category: 'tenant', sampleValue: 'John Smith' },
  { key: 'tenant.first_name', label: 'First Name', category: 'tenant', sampleValue: 'John' },
  { key: 'tenant.last_name', label: 'Last Name', category: 'tenant', sampleValue: 'Smith' },
  { key: 'tenant.email', label: 'Email', category: 'tenant', sampleValue: 'john.smith@email.com' },
  { key: 'tenant.phone', label: 'Phone', category: 'tenant', sampleValue: '07700 900123' },

  // Tenancy
  { key: 'tenancy.start_date', label: 'Start Date', category: 'tenancy', sampleValue: '01 January 2026' },
  { key: 'tenancy.end_date', label: 'End Date', category: 'tenancy', sampleValue: '31 December 2026' },
  { key: 'tenancy.rent_pcm', label: 'Rent (£/month)', category: 'tenancy', sampleValue: '850.00' },
  { key: 'tenancy.deposit_amount', label: 'Deposit Amount', category: 'tenancy', sampleValue: '850.00' },
  { key: 'tenancy.deposit_scheme', label: 'Deposit Scheme', category: 'tenancy', sampleValue: 'DPS' },
  { key: 'tenancy.type', label: 'Tenancy Type', category: 'tenancy', sampleValue: 'AST' },
  { key: 'tenancy.room_name', label: 'Room Name', category: 'tenancy', sampleValue: 'Room 3' },

  // Dates
  { key: 'dates.today', label: 'Today', category: 'dates', sampleValue: format(new Date(), 'dd MMMM yyyy') },
  { key: 'dates.today_short', label: 'Today (Short)', category: 'dates', sampleValue: format(new Date(), 'dd/MM/yyyy') },
];

// ── Merge template function ──────────────────────────────────

const MERGE_FIELD_REGEX = /\{\{([^}]+)\}\}/g;

/**
 * Replace all {{field.key}} placeholders in a template with values from mergeData.
 * Unresolved fields are left as-is.
 */
export function mergeTemplate(template: string, mergeData: Record<string, string>): string {
  return template.replace(MERGE_FIELD_REGEX, (match, key: string) => {
    const trimmed = key.trim();
    return mergeData[trimmed] ?? match;
  });
}

/**
 * Extract all merge field keys found in a template string.
 */
export function extractMergeFields(template: string): string[] {
  const fields: string[] = [];
  let m: RegExpExecArray | null;
  const regex = new RegExp(MERGE_FIELD_REGEX.source, 'g');
  while ((m = regex.exec(template)) !== null) {
    const key = m[1].trim();
    if (!fields.includes(key)) fields.push(key);
  }
  return fields;
}

/**
 * Build sample merge data for preview mode.
 */
export function buildSampleMergeData(): Record<string, string> {
  const data: Record<string, string> = {};
  for (const field of MERGE_FIELDS) {
    data[field.key] = field.sampleValue;
  }
  return data;
}

// ── Resolve merge data from Supabase records ─────────────────

interface ResolveContext {
  propertyId?: string;
  tenantId?: string;
  tenancyId?: string;
  entityId?: string;
}

function formatDate(d: string | null | undefined): string {
  if (!d) return '';
  try {
    return format(new Date(d), 'dd MMMM yyyy');
  } catch {
    return d;
  }
}

function _formatDateShort(d: string | null | undefined): string {
  if (!d) return '';
  try {
    return format(new Date(d), 'dd/MM/yyyy');
  } catch {
    return d;
  }
}

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  hmo_licensed: 'HMO Licensed',
  hmo_mandatory: 'HMO Mandatory',
  single_let: 'Single Let',
  multi_unit_freehold: 'Multi-Unit Freehold',
  commercial: 'Commercial',
  mixed_use: 'Mixed Use',
};

const TENANCY_TYPE_LABELS: Record<string, string> = {
  ast: 'AST',
  licence_to_occupy: 'Licence to Occupy',
  contractual_periodic: 'Contractual Periodic',
  statutory_periodic: 'Statutory Periodic',
  company_let: 'Company Let',
};

const DEPOSIT_SCHEME_LABELS: Record<string, string> = {
  dps: 'DPS',
  mydeposits: 'MyDeposits',
  tds: 'TDS',
  none: 'None',
};

/**
 * Resolve merge data from Supabase records for given context IDs.
 */
export async function resolveMergeData(ctx: ResolveContext): Promise<Record<string, string>> {
  const data: Record<string, string> = {};

  // Dates
  data['dates.today'] = format(new Date(), 'dd MMMM yyyy');
  data['dates.today_short'] = format(new Date(), 'dd/MM/yyyy');

  // Property + Entity
  if (ctx.propertyId) {
    const { data: prop } = await supabaseAny
      .from('properties_v2')
      .select('*, legal_entities!properties_v2_entity_id_fkey!inner(entity_name, entity_type, company_number, registered_address, vat_number)')
      .eq('id', ctx.propertyId)
      .single();

    if (prop) {
      data['property.address_line_1'] = prop.address_line_1 || '';
      data['property.address_line_2'] = prop.address_line_2 || '';
      data['property.city'] = prop.city || '';
      data['property.county'] = prop.county || '';
      data['property.postcode'] = prop.postcode || '';
      data['property.full_address'] = [prop.address_line_1, prop.city, prop.postcode].filter(Boolean).join(', ');
      data['property.type'] = PROPERTY_TYPE_LABELS[prop.property_type] || prop.property_type || '';

      const entity = prop.legal_entities;
      if (entity) {
        data['landlord.name'] = entity.entity_name || '';
        data['landlord.entity_type'] = (entity.entity_type || '').toUpperCase();
        data['landlord.company_number'] = entity.company_number || '';
        data['landlord.registered_address'] = entity.registered_address || '';
        data['landlord.vat_number'] = entity.vat_number || '';
      }
    }
  }

  // Override entity if explicitly provided
  if (ctx.entityId && !ctx.propertyId) {
    const { data: entity } = await supabaseAny
      .from('legal_entities')
      .select('*')
      .eq('id', ctx.entityId)
      .single();

    if (entity) {
      data['landlord.name'] = entity.entity_name || '';
      data['landlord.entity_type'] = (entity.entity_type || '').toUpperCase();
      data['landlord.company_number'] = entity.company_number || '';
      data['landlord.registered_address'] = entity.registered_address || '';
      data['landlord.vat_number'] = entity.vat_number || '';
    }
  }

  // Tenant
  if (ctx.tenantId) {
    const { data: tenant } = await supabaseAny
      .from('tenants_v2')
      .select('*')
      .eq('id', ctx.tenantId)
      .single();

    if (tenant) {
      data['tenant.first_name'] = tenant.first_name || '';
      data['tenant.last_name'] = tenant.last_name || '';
      data['tenant.full_name'] = [tenant.first_name, tenant.last_name].filter(Boolean).join(' ');
      data['tenant.email'] = tenant.email || '';
      data['tenant.phone'] = tenant.phone || '';
    }
  }

  // Tenancy
  if (ctx.tenancyId) {
    const { data: tenancy } = await supabaseAny
      .from('tenancy_agreements')
      .select('*')
      .eq('id', ctx.tenancyId)
      .single();

    if (tenancy) {
      data['tenancy.start_date'] = formatDate(tenancy.start_date);
      data['tenancy.end_date'] = formatDate(tenancy.initial_end_date);
      data['tenancy.rent_pcm'] = tenancy.rent_amount_pcm?.toFixed(2) || '';
      data['tenancy.deposit_amount'] = tenancy.deposit_amount?.toFixed(2) || '';
      data['tenancy.deposit_scheme'] = DEPOSIT_SCHEME_LABELS[tenancy.deposit_scheme] || tenancy.deposit_scheme || '';
      data['tenancy.type'] = TENANCY_TYPE_LABELS[tenancy.tenancy_type] || tenancy.tenancy_type || '';
      data['tenancy.room_name'] = tenancy.room_name || '';

      // If tenant not explicitly provided, resolve from tenancy
      if (!ctx.tenantId && tenancy.tenant_id) {
        const { data: tenant } = await supabaseAny
          .from('tenants_v2')
          .select('*')
          .eq('id', tenancy.tenant_id)
          .single();

        if (tenant) {
          data['tenant.first_name'] = tenant.first_name || '';
          data['tenant.last_name'] = tenant.last_name || '';
          data['tenant.full_name'] = [tenant.first_name, tenant.last_name].filter(Boolean).join(' ');
          data['tenant.email'] = tenant.email || '';
          data['tenant.phone'] = tenant.phone || '';
        }
      }
    }
  }

  return data;
}
