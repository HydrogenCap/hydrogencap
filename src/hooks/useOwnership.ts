import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { fetchUserOrgId as getUserOrgId } from './useUserOrg';
import { showMutationError, showMutationSuccess } from '@/lib/errorToast';

type OwnershipEntity = Database['public']['Tables']['ownership_entities']['Row'];
type OwnershipEntityInsert = Database['public']['Tables']['ownership_entities']['Insert'];
type PropertyOwnership = Database['public']['Tables']['property_ownership']['Row'];
type PropertyOwnershipInsert = Database['public']['Tables']['property_ownership']['Insert'];

export interface PropertyOwnershipWithEntity extends PropertyOwnership {
  ownership_entities: OwnershipEntity;
}

// Fetch all ownership entities for the user's organization
export function useOwnershipEntities() {
  return useQuery({
    queryKey: ['ownership_entities'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ownership_entities')
        .select('*')
        .order('name');

      if (error) throw error;
      return data as OwnershipEntity[];
    },
  });
}

// Fetch property ownership for a specific property
export function usePropertyOwnership(propertyId: string | undefined) {
  return useQuery({
    queryKey: ['property_ownership', propertyId],
    queryFn: async () => {
      if (!propertyId) return [];
      
      const { data, error } = await supabase
        .from('property_ownership')
        .select(`
          *,
          ownership_entities(*)
        `)
        .eq('property_id', propertyId)
        .order('ownership_level')
        .order('ownership_percent', { ascending: false });

      if (error) throw error;
      return data as PropertyOwnershipWithEntity[];
    },
    enabled: !!propertyId,
  });
}

// Create an ownership entity
export function useCreateOwnershipEntity() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (entity: Omit<OwnershipEntityInsert, 'org_id'>) => {
      const orgId = await getUserOrgId();
      if (!orgId) throw new Error('No organization found');

      const { data, error } = await supabase
        .from('ownership_entities')
        .insert({ ...entity, org_id: orgId })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ownership_entities'] });
      showMutationSuccess('Entity created');
    },
    onError: (error) => {
      showMutationError(error, 'Failed to create entity');
    },
  });
}

// Update an ownership entity
export function useUpdateOwnershipEntity() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...entity }: Partial<OwnershipEntity> & { id: string }) => {
      const { data, error } = await supabase
        .from('ownership_entities')
        .update(entity)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ownership_entities'] });
      queryClient.invalidateQueries({ queryKey: ['property_ownership'] });
      showMutationSuccess('Entity updated');
    },
    onError: (error) => {
      showMutationError(error, 'Failed to update entity');
    },
  });
}

// Delete an ownership entity
export function useDeleteOwnershipEntity() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('ownership_entities')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ownership_entities'] });
      queryClient.invalidateQueries({ queryKey: ['property_ownership'] });
      showMutationSuccess('Entity deleted');
    },
    onError: (error) => {
      showMutationError(error, 'Failed to delete entity');
    },
  });
}

// Add property ownership
export function useAddPropertyOwnership() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (ownership: PropertyOwnershipInsert) => {
      const { data, error } = await supabase
        .from('property_ownership')
        .insert(ownership)
        .select(`
          *,
          ownership_entities(*)
        `)
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['property_ownership', data.property_id] });
      showMutationSuccess('Ownership added');
    },
    onError: (error) => {
      showMutationError(error, 'Failed to add ownership');
    },
  });
}

// Update property ownership
export function useUpdatePropertyOwnership() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...ownership }: Partial<PropertyOwnership> & { id: string }) => {
      const { data, error } = await supabase
        .from('property_ownership')
        .update(ownership)
        .eq('id', id)
        .select(`
          *,
          ownership_entities(*)
        `)
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['property_ownership', data.property_id] });
      showMutationSuccess('Ownership updated');
    },
    onError: (error) => {
      showMutationError(error, 'Failed to update ownership');
    },
  });
}

// Delete property ownership
export function useDeletePropertyOwnership() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, propertyId }: { id: string; propertyId: string }) => {
      const { error } = await supabase
        .from('property_ownership')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { propertyId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['property_ownership', data.propertyId] });
      showMutationSuccess('Ownership removed');
    },
    onError: (error) => {
      showMutationError(error, 'Failed to remove ownership');
    },
  });
}
