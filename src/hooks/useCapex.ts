import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseAny } from '@/integrations/supabase/client';
import { fetchUserOrgId } from '@/hooks/useUserOrg';
import { toast } from "sonner";

export interface CapexProject {
  id: string;
  org_id: string;
  property_id: string;
  name: string;
  description: string | null;
  status: string;
  budget_gbp: number;
  actual_gbp: number;
  start_date: string | null;
  target_end_date: string | null;
  actual_end_date: string | null;
  created_at: string;
  updated_at: string;
  line_items?: CapexLineItem[];
}

export interface CapexLineItem {
  id: string;
  project_id: string;
  category: string;
  description: string;
  budget_gbp: number;
  actual_gbp: number;
  supplier: string | null;
  invoice_ref: string | null;
  paid_date: string | null;
  notes: string | null;
  created_at: string;
}

export function useCapexProjects(propertyId: string) {
  return useQuery({
    queryKey: ['capex-projects', propertyId],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('capex_projects')
        .select('*, capex_line_items(*)')
        .eq('property_id', propertyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as CapexProject[];
    },
  });
}

export function useCreateCapexProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (project: {
      property_id: string;
      name: string;
      description?: string;
      budget_gbp: number;
      start_date?: string;
      target_end_date?: string;
    }) => {
      const orgId = await fetchUserOrgId();

      const { data, error } = await supabaseAny
        .from('capex_projects')
        .insert({ ...project, org_id: orgId })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['capex-projects', data.property_id] });
      toast.success('Project created');
    },
    onError: (error) => {
      toast.error('Error', { description: error.message });
    },
  });
}

export function useUpdateCapexProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CapexProject> & { id: string }) => {
      const { data, error } = await supabaseAny
        .from('capex_projects')
        .update(updates)
        .eq('id', id)
        .select('property_id')
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['capex-projects', data.property_id] });
      toast.success('Project updated');
    },
  });
}

export function useAddCapexLineItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (item: {
      project_id: string;
      category: string;
      description: string;
      budget_gbp: number;
      actual_gbp?: number;
      supplier?: string;
      invoice_ref?: string;
      paid_date?: string;
      notes?: string;
    }) => {
      const { data, error } = await supabaseAny
        .from('capex_line_items')
        .insert(item)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, _variables) => {
      queryClient.invalidateQueries({ queryKey: ['capex-projects'] });
      toast.success('Line item added');
    },
  });
}

export function useUpdateCapexLineItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CapexLineItem> & { id: string }) => {
      const { error } = await supabaseAny
        .from('capex_line_items')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['capex-projects'] });
    },
  });
}

export function useDeleteCapexLineItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabaseAny
        .from('capex_line_items')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['capex-projects'] });
    },
  });
}
