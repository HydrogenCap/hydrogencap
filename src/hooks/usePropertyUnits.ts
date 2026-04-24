import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, supabaseAny } from '@/integrations/supabase/client';

export interface PropertyUnit {
  id: string;
  property_id: string;
  unit_name: string;
  rent_basis: 'room' | 'whole_house';
  whole_house_rent_pcm: number | null;
  is_lettable: boolean;
  sort_order: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function usePropertyUnits(propertyId: string | undefined) {
  return useQuery({
    queryKey: ['property_units', propertyId],
    queryFn: async () => {
      if (!propertyId) return [];
      const { data, error } = await supabaseAny
        .from('property_units')
        .select('*')
        .eq('property_id', propertyId)
        .order('sort_order')
        .order('created_at');
      if (error) throw error;
      return data as PropertyUnit[];
    },
    enabled: !!propertyId,
  });
}

export function useCreatePropertyUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (unit: Omit<PropertyUnit, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase.from('property_units').insert(unit).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['property_units', data.property_id] });
    },
  });
}

export function useUpdatePropertyUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...unit }: Partial<PropertyUnit> & { id: string }) => {
      const { data, error } = await supabase.from('property_units').update(unit).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['property_units', data.property_id] });
    },
  });
}

export function useDeletePropertyUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, propertyId }: { id: string; propertyId: string }) => {
      const { error } = await supabase.from('property_units').delete().eq('id', id);
      if (error) throw error;
      return propertyId;
    },
    onSuccess: (propertyId) => {
      qc.invalidateQueries({ queryKey: ['property_units', propertyId] });
      qc.invalidateQueries({ queryKey: ['rooms_v2', propertyId] });
    },
  });
}
