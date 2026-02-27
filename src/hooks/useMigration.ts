import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchUserOrgId } from './useUserOrg';
import type { MigrationStep, MigrationResult, FullMigrationResult } from '@/lib/migrationTypes';
import { getMigrationStatus } from '@/lib/migrationTypes';

const MIGRATION_STEPS = [
  { key: 'companies', title: 'Companies → Legal Entities', v1Table: 'companies', v2Table: 'legal_entities', functionName: 'migrate_companies_to_entities' },
  { key: 'properties', title: 'Properties → Properties V2', v1Table: 'properties', v2Table: 'properties_v2', functionName: 'migrate_properties_to_v2' },
  { key: 'rooms', title: 'Rooms → Rooms V2', v1Table: 'rooms', v2Table: 'rooms_v2', functionName: 'migrate_rooms_to_v2' },
  { key: 'tenants', title: 'Tenants → Tenants V2', v1Table: 'tenants', v2Table: 'tenants_v2', functionName: 'migrate_tenants_to_v2' },
  { key: 'tenancies', title: 'Tenancies → Tenancy Agreements', v1Table: 'tenancies', v2Table: 'tenancy_agreements', functionName: 'migrate_tenancies_to_agreements' },
  { key: 'compliance', title: 'Compliance → Compliance V2', v1Table: 'compliance_items', v2Table: 'compliance_documents_v2', functionName: 'migrate_compliance_to_v2' },
];

async function getTableCount(table: string, orgId: string): Promise<number> {
  const { count, error } = await supabase
    .from(table as any)
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

export function useRunMigrationStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (functionName: string): Promise<MigrationResult> => {
      const orgId = await fetchUserOrgId();
      const { data, error } = await supabase.rpc(functionName as any, { p_org_id: orgId });
      if (error) throw error;
      return data as unknown as MigrationResult;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['migration_status'] });
      qc.invalidateQueries({ queryKey: ['properties_v2'] });
      qc.invalidateQueries({ queryKey: ['rooms_v2'] });
    },
  });
}

export function useRunFullMigration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<FullMigrationResult> => {
      const orgId = await fetchUserOrgId();
      const { data, error } = await supabase.rpc('run_v1_to_v2_migration' as any, { p_org_id: orgId });
      if (error) throw error;
      return data as unknown as FullMigrationResult;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['migration_status'] });
      qc.invalidateQueries({ queryKey: ['properties_v2'] });
      qc.invalidateQueries({ queryKey: ['rooms_v2'] });
    },
  });
}

// Gap-fill hooks
export function usePropertyGaps() {
  return useQuery({
    queryKey: ['property_gaps'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('properties_v2')
        .select('id, address_line_1, postcode, city, entity_id, has_gas_supply, current_valuation, purchase_price, property_type, year_built, total_lettable_rooms, total_floors, council_name, council_area')
        .order('address_line_1');
      if (error) throw error;
      return data || [];
    },
  });
}

export function useRoomGaps() {
  return useQuery({
    queryKey: ['room_gaps'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rooms_v2')
        .select('id, room_name, property_id, room_type, current_rent_pcm, target_rent_pcm, has_ensuite, is_lettable, floor, properties_v2!inner(address_line_1)')
        .order('room_name');
      if (error) throw error;
      return (data || []).map((r: any) => ({
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
      const { data, error } = await supabase
        .from('tenants_v2' as any)
        .select('id, first_name, last_name, email, phone, date_of_birth, national_insurance, emergency_contact_name, emergency_contact_phone')
        .order('last_name');
      if (error) throw error;
      return (data || []) as any[];
    },
  });
}

export function useTenancyGaps() {
  return useQuery({
    queryKey: ['tenancy_gaps'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenancy_agreements')
        .select('id, tenant_id, property_id, room_id, rent_amount_pcm, tenancy_type, deposit_amount, deposit_scheme, deposit_reference, deposit_protected_date, how_to_rent_served_date, prescribed_info_served_date, status')
        .eq('status', 'active')
        .order('start_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useBatchUpdateProperties() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (updates: { id: string; [key: string]: any }[]) => {
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
    mutationFn: async (updates: { id: string; [key: string]: any }[]) => {
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
    mutationFn: async (updates: { id: string; [key: string]: any }[]) => {
      for (const { id, ...fields } of updates) {
        const { error } = await supabase.from('tenants_v2' as any).update(fields).eq('id', id);
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
    mutationFn: async (updates: { id: string; [key: string]: any }[]) => {
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
