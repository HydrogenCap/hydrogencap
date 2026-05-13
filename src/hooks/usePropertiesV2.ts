import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, supabaseAny } from '@/integrations/supabase/client';
import { fetchUserOrgId } from './useUserOrg';

export interface PropertyV2 {
  id: string;
  org_id: string;
  entity_id: string;
  address_line_1: string;
  address_line_2: string | null;
  city: string;
  county: string | null;
  postcode: string;
  country: string | null;
  property_type: string;
  lifecycle_stage: string;
  council_name: string | null;
  council_area: string | null;
  listing_grade: string;
  rent_basis: 'room' | 'whole_house';
  whole_house_rent_pcm: number | null;
  has_gas_supply: boolean | null;
  year_built: number | null;
  total_floors: number | null;
  total_lettable_rooms: number | null;
  purchase_date: string | null;
  purchase_price: number | null;
  current_valuation: number | null;
  valuation_date: string | null;
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
  epc_rating: string | null;
  epc_expiry_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface PropertyWithEntity extends PropertyV2 {
  entity_name: string;
  entity_type: string;
}

type PropertyWithEntityJoin = PropertyV2 & {
  legal_entities?: {
    entity_name: string;
    entity_type: string;
  } | null;
};

export interface PropertyComplianceStatusRow {
  property_id: string | null;
  is_required: boolean | null;
  calculated_status: string | null;
}

export type PropertyComplianceStatus = 'grey' | 'green' | 'amber' | 'red';

export function usePropertiesV2() {
  return useQuery({
    queryKey: ['properties_v2'],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('properties_v2')
        .select('*, legal_entities!properties_v2_entity_id_fkey!inner(entity_name, entity_type)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return ((data || []) as PropertyWithEntityJoin[]).map((p) => ({
        ...p,
        entity_name: p.legal_entities?.entity_name ?? '',
        entity_type: p.legal_entities?.entity_type ?? '',
        legal_entities: undefined,
      })) as PropertyWithEntity[];
    },
  });
}

export function usePropertyV2(id: string | undefined) {
  return useQuery({
    queryKey: ['property_v2', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabaseAny
        .from('properties_v2')
        .select('*, legal_entities!properties_v2_entity_id_fkey!inner(entity_name, entity_type)')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const property = data as PropertyWithEntityJoin;
      return {
        ...property,
        entity_name: property.legal_entities?.entity_name ?? '',
        entity_type: property.legal_entities?.entity_type ?? '',
        legal_entities: undefined,
      } as PropertyWithEntity;
    },
    enabled: !!id,
  });
}

export function useEntityPropertiesV2(entityId: string | undefined) {
  return useQuery({
    queryKey: ['properties_v2_by_entity', entityId],
    queryFn: async () => {
      if (!entityId) return [];
      const { data, error } = await supabaseAny
        .from('properties_v2')
        .select('*')
        .eq('entity_id', entityId)
        .order('address_line_1');
      if (error) throw error;
      return data as PropertyV2[];
    },
    enabled: !!entityId,
  });
}

export function usePropertyComplianceStatusMap() {
  return useQuery({
    queryKey: ['property_compliance_status_map'],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('compliance_matrix_v2')
        .select('property_id, is_required, calculated_status');
      if (error) throw error;

      const grouped = new Map<string, PropertyComplianceStatusRow[]>();
      for (const row of (data || []) as PropertyComplianceStatusRow[]) {
        if (!row.property_id) continue;
        const rows = grouped.get(row.property_id) || [];
        rows.push(row);
        grouped.set(row.property_id, rows);
      }

      const statuses = new Map<string, PropertyComplianceStatus>();
      grouped.forEach((rows, propertyId) => {
        statuses.set(propertyId, getPropertyComplianceStatus(rows));
      });
      return statuses;
    },
    staleTime: 2 * 60 * 1000,
  });
}

type PropertyV2Insert = Omit<PropertyV2, 'id' | 'created_at' | 'updated_at' | 'org_id' | 'epc_rating' | 'epc_expiry_date'>;

export function useCreatePropertyV2() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (property: PropertyV2Insert) => {
      const orgId = await fetchUserOrgId();
      const { data, error } = await supabaseAny
        .from('properties_v2')
        .insert({ ...property, org_id: orgId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['properties_v2'] });
      qc.invalidateQueries({ queryKey: ['property_compliance_status_map'] });
    },
  });
}

export function useUpdatePropertyV2() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...property }: Partial<PropertyV2> & { id: string }) => {
      const { data, error } = await supabaseAny
        .from('properties_v2')
        .update(property)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['properties_v2'] });
      qc.invalidateQueries({ queryKey: ['property_v2', data.id] });
    },
  });
}

export function useDeletePropertyV2() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('properties_v2').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['properties_v2'] });
      qc.invalidateQueries({ queryKey: ['property_compliance_status_map'] });
    },
  });
}

export function getPropertyComplianceStatus(rows?: PropertyComplianceStatusRow[]): PropertyComplianceStatus {
  const requiredRows = (rows || []).filter((row) => row.is_required);
  if (requiredRows.length === 0) return 'grey';

  if (requiredRows.some((row) => row.calculated_status === 'expired' || row.calculated_status === 'missing')) {
    return 'red';
  }

  if (requiredRows.some((row) => row.calculated_status === 'critical' || row.calculated_status === 'expiring_soon')) {
    return 'amber';
  }

  if (requiredRows.every((row) => row.calculated_status === 'valid')) {
    return 'green';
  }

  return 'grey';
}

// Constants
export const PROPERTY_TYPES = [
  { value: 'hmo_licensed', label: 'HMO (Licensed)' },
  { value: 'hmo_mandatory', label: 'HMO (Mandatory)' },
  { value: 'single_let', label: 'Single Let' },
  { value: 'multi_unit_freehold', label: 'MUFB' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'mixed_use', label: 'Mixed Use' },
] as const;

export const LIFECYCLE_STAGES = [
  { value: 'pipeline', label: 'Pipeline' },
  { value: 'acquisition', label: 'Acquisition' },
  { value: 'refurbishment', label: 'Refurbishment' },
  { value: 'letting', label: 'Letting' },
  { value: 'stabilised', label: 'Stabilised' },
  { value: 'disposal', label: 'Disposal' },
] as const;

export const LISTING_GRADES = [
  { value: 'none', label: 'None' },
  { value: 'grade_i', label: 'Grade I' },
  { value: 'grade_ii', label: 'Grade II' },
  { value: 'grade_ii_star', label: 'Grade II*' },
  { value: 'locally_listed', label: 'Locally Listed' },
] as const;
