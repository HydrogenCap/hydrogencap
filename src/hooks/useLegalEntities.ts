import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';

export interface LegalEntity {
  id: string;
  org_id: string;
  entity_name: string;
  entity_type: 'spv' | 'personal' | 'joint_venture' | 'trust';
  company_number: string | null;
  incorporation_date: string | null;
  registered_address: string | null;
  corporation_tax_ref: string | null;
  vat_registered: boolean;
  vat_number: string | null;
  issued_shares: number | null;
  status: 'active' | 'dormant' | 'dissolved';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface EntityDirector {
  id: string;
  entity_id: string;
  director_name: string;
  appointment_date: string;
  resignation_date: string | null;
  is_current: boolean;
  created_at: string;
  updated_at: string;
}

export interface EntityShareholder {
  id: string;
  entity_id: string;
  shareholder_name: string;
  share_class: string;
  shares_held: number;
  percentage: number;
  effective_date: string;
  created_at: string;
  updated_at: string;
}

export function useLegalEntities() {
  const { data: org } = useOrganization();
  return useQuery({
    queryKey: ['legal_entities', org?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('legal_entities')
        .select('*')
        .eq('org_id', org!.id)
        .order('entity_name');
      if (error) throw error;
      return data as LegalEntity[];
    },
    enabled: !!org?.id,
  });
}

export function useLegalEntity(id: string | undefined) {
  return useQuery({
    queryKey: ['legal_entity', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('legal_entities')
        .select('*')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data as LegalEntity;
    },
    enabled: !!id,
  });
}

export function useEntityDirectors(entityId: string | undefined) {
  return useQuery({
    queryKey: ['entity_directors', entityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('entity_directors')
        .select('*')
        .eq('entity_id', entityId!)
        .order('is_current', { ascending: false })
        .order('appointment_date', { ascending: false });
      if (error) throw error;
      return data as EntityDirector[];
    },
    enabled: !!entityId,
  });
}

export function useEntityShareholders(entityId: string | undefined) {
  return useQuery({
    queryKey: ['entity_shareholders', entityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('entity_shareholders')
        .select('*')
        .eq('entity_id', entityId!)
        .order('percentage', { ascending: false });
      if (error) throw error;
      return data as EntityShareholder[];
    },
    enabled: !!entityId,
  });
}

export function useCreateLegalEntity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (entity: Omit<LegalEntity, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('legal_entities')
        .insert(entity)
        .select()
        .single();
      if (error) throw error;
      return data as LegalEntity;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['legal_entities'] });
    },
  });
}

export function useUpdateLegalEntity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<LegalEntity> & { id: string }) => {
      const { data, error } = await supabase
        .from('legal_entities')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as LegalEntity;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['legal_entities'] });
      queryClient.invalidateQueries({ queryKey: ['legal_entity', data.id] });
    },
  });
}

export function useDeleteLegalEntity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('legal_entities').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['legal_entities'] });
    },
  });
}

export function useCreateDirector() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (director: Omit<EntityDirector, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('entity_directors')
        .insert(director)
        .select()
        .single();
      if (error) throw error;
      return data as EntityDirector;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['entity_directors', data.entity_id] });
    },
  });
}

export function useUpdateDirector() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<EntityDirector> & { id: string }) => {
      const { data, error } = await supabase
        .from('entity_directors')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as EntityDirector;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['entity_directors', data.entity_id] });
    },
  });
}

export function useDeleteDirector() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, entityId }: { id: string; entityId: string }) => {
      const { error } = await supabase.from('entity_directors').delete().eq('id', id);
      if (error) throw error;
      return entityId;
    },
    onSuccess: (entityId) => {
      queryClient.invalidateQueries({ queryKey: ['entity_directors', entityId] });
    },
  });
}

export function useCreateShareholder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (shareholder: Omit<EntityShareholder, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('entity_shareholders')
        .insert(shareholder)
        .select()
        .single();
      if (error) throw error;
      return data as EntityShareholder;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['entity_shareholders', data.entity_id] });
    },
  });
}

export function useUpdateShareholder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<EntityShareholder> & { id: string }) => {
      const { data, error } = await supabase
        .from('entity_shareholders')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as EntityShareholder;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['entity_shareholders', data.entity_id] });
    },
  });
}

export function useDeleteShareholder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, entityId }: { id: string; entityId: string }) => {
      const { error } = await supabase.from('entity_shareholders').delete().eq('id', id);
      if (error) throw error;
      return entityId;
    },
    onSuccess: (entityId) => {
      queryClient.invalidateQueries({ queryKey: ['entity_shareholders', entityId] });
    },
  });
}
