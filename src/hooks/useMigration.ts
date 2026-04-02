import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchUserOrgId } from './useUserOrg';
import type { MigrationStep, MigrationResult, FullMigrationResult } from '@/lib/migrationTypes';
import { getMigrationStatus } from '@/lib/migrationTypes';

export interface PropertyGap {
  id: string;
  address_line_1: string;
  postcode: string | null;
  city: string | null;
  entity_id: string | null;
  has_gas_supply: boolean | null;
  current_valuation: number | null;
  purchase_price: number | null;
  property_type: string | null;
  year_built: number | null;
  total_lettable_rooms: number | null;
  total_floors: number | null;
  council_name: string | null;
  council_area: string | null;
}

interface RoomGapRow {
  id: string;
  room_name: string;
  property_id: string;
  room_type: string | null;
  current_rent_pcm: number | null;
  target_rent_pcm: number | null;
  has_ensuite: boolean | null;
  is_lettable: boolean | null;
  floor: number | null;
  properties_v2: { address_line_1: string | null } | null;
}

export interface RoomGap extends Omit<RoomGapRow, 'properties_v2'> {
  property_address: string;
}

export interface TenantGap {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  date_of_birth: string | null;
  national_insurance: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
}

export interface TenancyGap {
  id: string;
  tenant_id: string;
  property_id: string;
  room_id: string;
  rent_amount_pcm: number;
  tenancy_type: string;
  deposit_amount: number | null;
  deposit_scheme: string | null;
  deposit_reference: string | null;
  deposit_protected_date: string | null;
  how_to_rent_served_date: string | null;
  prescribed_info_served_date: string | null;
  status: string;
}

type MigrationPropertyUpdate = { id: string } & Record<string, unknown>;
type MigrationRoomUpdate = { id: string } & Record<string, unknown>;
type MigrationTenantUpdate = { id: string } & Record<string, unknown>;
type MigrationTenancyUpdate = { id: string } & Record<string, unknown>;

const MIGRATION_STEPS = [
  { key: 'companies', title: 'Companies → Legal Entities', v1Table: 'companies', v2Table: 'legal_entities', functionName: 'migrate_companies_to_entities' },
  { key: 'properties', title: 'Properties → Properties V2', v1Table: 'properties', v2Table: 'properties_v2', functionName: 'migrate_properties_to_v2' },
  { key: 'rooms', title: 'Rooms → Rooms V2', v1Table: 'rooms', v2Table: 'rooms_v2', functionName: 'migrate_rooms_to_v2' },
  { key: 'tenants', title: 'Tenants → Tenants V2', v1Table: 'tenants', v2Table: 'tenants_v2', functionName: 'migrate_tenants_to_v2' },
  { key: 'tenancies', title: 'Tenancies → Tenancy Agreements', v1Table: 'tenancies', v2Table: 'tenancy_agreements', functionName: 'migrate_tenancies_to_agreements' },
  { key: 'compliance', title: 'Compliance → Compliance V2', v1Table: 'compliance_items', v2Table: 'compliance_documents_v2', functionName: 'migrate_compliance_to_v2' },
  { key: 'loans', title: 'Loans → Loan Facilities', v1Table: 'loans', v2Table: 'loan_facilities', functionName: 'migrate_loans_to_v2' },
  { key: 'financials', title: 'Income/Costs → Financial Snapshots', v1Table: 'income', v2Table: 'financial_snapshots', functionName: 'migrate_income_costs_to_snapshots' },
  { key: 'contractors', title: 'Contractors → Contractors V2', v1Table: 'contractors', v2Table: 'compliance_contractors_v2', functionName: 'migrate_contractors_to_v2' },
];

// Tables that don't have org_id and need to be counted via a join or without org filter
const TABLES_WITHOUT_ORG_ID = ['income', 'loans', 'rooms', 'rooms_v2'];

async function getTableCount(table: string, orgId: string): Promise<number> {
  if (TABLES_WITHOUT_ORG_ID.includes(table)) {
    // These tables link via property_id → properties.org_id
    // For rooms_v2, link via property_id → properties_v2.org_id
    if (table === 'rooms_v2') {
      const { count, error } = await (supabase as any)
        .from('rooms_v2')
        .select('*, properties_v2!inner(org_id)', { count: 'exact', head: true })
        .eq('properties_v2.org_id', orgId);
      if (error) return 0;
      return count || 0;
    }
    // For income, loans, rooms — join via properties
    const { count, error } = await (supabase as any)
      .from(table as never)
      .select('*, properties!inner(org_id)', { count: 'exact', head: true })
      .eq('properties.org_id', orgId);
    if (error) return 0;
    return count || 0;
  }
  const { count, error } = await (supabase as any)
    .from(table as never)
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId);
  if (error) return 0;
  return count || 0;
}

export function useMigrationStatus() {
  return useQuery({
    queryKey: ['migration_status'],
    queryFn: async () => {
      const orgId = await fetchUserOrgId();
      const steps: MigrationStep[] = [];

      for (const step of MIGRATION_STEPS) {
        const [v1Count, v2Count] = await Promise.all([
          getTableCount(step.v1Table, orgId),
          getTableCount(step.v2Table, orgId),
        ]);
        steps.push({
          ...step,
          v1Count,
          v2Count,
          status: getMigrationStatus(v1Count, v2Count),
        });
      }

      return steps;
    },
  });
}

type MigrationFunctionName =
  | 'migrate_companies_to_entities'
  | 'migrate_properties_to_v2'
  | 'migrate_rooms_to_v2'
  | 'migrate_tenants_to_v2'
  | 'migrate_tenancies_to_agreements'
  | 'migrate_compliance_to_v2'
  | 'migrate_loans_to_v2'
  | 'migrate_income_costs_to_snapshots'
  | 'migrate_contractors_to_v2'
  | 'run_v1_to_v2_migration';

export function useRunMigrationStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (functionName: MigrationFunctionName): Promise<MigrationResult> => {
      const orgId = await fetchUserOrgId();
      const { data, error } = await supabase.rpc(functionName, { p_org_id: orgId } as { p_org_id: string });
      if (error) throw error;
      return data as unknown as MigrationResult;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['migration_status'] });
      qc.invalidateQueries({ queryKey: ['properties_v2'] });
      qc.invalidateQueries({ queryKey: ['rooms_v2'] });
      qc.invalidateQueries({ queryKey: ['loan_facilities'] });
      qc.invalidateQueries({ queryKey: ['financial_snapshots'] });
      qc.invalidateQueries({ queryKey: ['contractors_v2'] });
    },
  });
}

export function useRunFullMigration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<FullMigrationResult> => {
      const orgId = await fetchUserOrgId();
      const { data, error } = await supabase.rpc('run_v1_to_v2_migration' as MigrationFunctionName, { p_org_id: orgId } as { p_org_id: string });
      if (error) throw error;
      return data as unknown as FullMigrationResult;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['migration_status'] });
      qc.invalidateQueries({ queryKey: ['properties_v2'] });
      qc.invalidateQueries({ queryKey: ['rooms_v2'] });
      qc.invalidateQueries({ queryKey: ['loan_facilities'] });
      qc.invalidateQueries({ queryKey: ['financial_snapshots'] });
      qc.invalidateQueries({ queryKey: ['contractors_v2'] });
    },
  });
}

// Gap-fill hooks
export function usePropertyGaps() {
  return useQuery({
    queryKey: ['property_gaps'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('properties_v2')
        .select('id, address_line_1, postcode, city, entity_id, has_gas_supply, current_valuation, purchase_price, property_type, year_built, total_lettable_rooms, total_floors, council_name, council_area')
        .order('address_line_1');
      if (error) throw error;
      return (data || []) as PropertyGap[];
    },
  });
}

export function useRoomGaps() {
  return useQuery({
    queryKey: ['room_gaps'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('rooms_v2')
        .select('id, room_name, property_id, room_type, current_rent_pcm, target_rent_pcm, has_ensuite, is_lettable, floor, properties_v2!inner(address_line_1)')
        .order('room_name');
      if (error) throw error;
      return ((data || []) as RoomGapRow[]).map((r) => ({
        ...r,
        property_address: r.properties_v2?.address_line_1 ?? '',
        properties_v2: undefined,
      }));
    },
  });
}

export function useTenantGaps() {
  return useQuery({
    queryKey: ['tenant_gaps'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('tenants_v2')
        .select('id, first_name, last_name, email, phone, date_of_birth, national_insurance, emergency_contact_name, emergency_contact_phone')
        .order('last_name');
      if (error) throw error;
      return (data || []) as TenantGap[];
    },
  });
}

export function useTenancyGaps() {
  return useQuery({
    queryKey: ['tenancy_gaps'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('tenancy_agreements')
        .select('id, tenant_id, property_id, room_id, rent_amount_pcm, tenancy_type, deposit_amount, deposit_scheme, deposit_reference, deposit_protected_date, how_to_rent_served_date, prescribed_info_served_date, status')
        .eq('status', 'active')
        .order('start_date', { ascending: false });
      if (error) throw error;
      return (data || []) as TenancyGap[];
    },
  });
}

export function useBatchUpdateProperties() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (updates: MigrationPropertyUpdate[]) => {
      for (const { id, ...fields } of updates) {
        const { error } = await supabase.from('properties_v2').update(fields).eq('id', id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['property_gaps'] });
      qc.invalidateQueries({ queryKey: ['properties_v2'] });
    },
  });
}

export function useBatchUpdateRooms() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (updates: MigrationRoomUpdate[]) => {
      for (const { id, ...fields } of updates) {
        const { error } = await supabase.from('rooms_v2').update(fields).eq('id', id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['room_gaps'] });
      qc.invalidateQueries({ queryKey: ['rooms_v2'] });
    },
  });
}

export function useBatchUpdateTenants() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (updates: MigrationTenantUpdate[]) => {
      for (const { id, ...fields } of updates) {
        const { error } = await supabase.from('tenants_v2').update(fields).eq('id', id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenant_gaps'] });
    },
  });
}

export function useBatchUpdateTenancies() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (updates: MigrationTenancyUpdate[]) => {
      for (const { id, ...fields } of updates) {
        const { error } = await supabase.from('tenancy_agreements').update(fields).eq('id', id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenancy_gaps'] });
    },
  });
}
