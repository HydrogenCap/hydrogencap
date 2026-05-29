/**
 * Portfolio-wide CapEx hooks for list page and detail page.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, supabaseAny } from '@/integrations/supabase/client';
import { fetchUserOrgId, useUserOrg } from './useUserOrg';
import type { CapexProject } from './useCapex';
import { toast } from "sonner";

export interface CapexProjectWithProperty extends CapexProject {
  properties?: { id: string; address_line_1: string; city: string | null; postcode: string | null };
}

export function useAllCapexProjects() {
  const { data: orgId } = useUserOrg();

  return useQuery({
    queryKey: ['capex-all-projects', orgId],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('capex_projects')
        .select('*, capex_line_items(*), properties(id, address_line_1, city, postcode)')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as CapexProjectWithProperty[];
    },
    enabled: !!orgId,
  });
}

export function useCapexProject(projectId: string) {
  const { data: orgId } = useUserOrg();

  return useQuery({
    queryKey: ['capex-project', orgId, projectId],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('capex_projects')
        .select('*, capex_line_items(*), properties(id, address_line_1, city, postcode)')
        .eq('org_id', orgId!)
        .eq('id', projectId)
        .single();
      if (error) throw error;
      return data as unknown as CapexProjectWithProperty;
    },
    enabled: !!orgId && !!projectId,
  });
}

export function useCreateCapexProjectFull() {
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['capex-all-projects'] });
      queryClient.invalidateQueries({ queryKey: ['capex-projects'] });
      toast.success('Project created');
    },
    onError: (error: Error) => toast.error('Error', { description: error.message }),
  });
}

export function useCompleteCapexProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, propertyId }: { projectId: string; propertyId: string }) => {
      await supabase.from('capex_projects').update({
        status: 'complete',
        actual_end_date: new Date().toISOString().split('T')[0],
      }).eq('id', projectId);

      await supabase.from('properties_v2').update({
        lifecycle_stage: 'letting',
      }).eq('id', propertyId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['capex-all-projects'] });
      queryClient.invalidateQueries({ queryKey: ['capex-projects'] });
      toast.success('Project completed', { description: 'Property moved to Letting stage' });
    },
  });
}

export const CAPEX_TEMPLATES: Record<string, { category: string; description: string }[]> = {
  'Full HMO Conversion': [
    { category: 'Labour', description: 'Demolition' },
    { category: 'Labour', description: 'Structural work' },
    { category: 'Labour', description: 'Plumbing' },
    { category: 'Labour', description: 'Electrics' },
    { category: 'Materials', description: 'Fire safety (doors, alarm, lighting)' },
    { category: 'Fixtures & Fittings', description: 'Kitchen' },
    { category: 'Fixtures & Fittings', description: 'Bathrooms' },
    { category: 'Labour', description: 'Decoration' },
    { category: 'Materials', description: 'Flooring' },
    { category: 'Fixtures & Fittings', description: 'Furniture' },
    { category: 'Professional Fees', description: 'Professional fees' },
    { category: 'Contingency', description: 'Contingency' },
  ],
  'Light Refurb': [
    { category: 'Labour', description: 'Decoration' },
    { category: 'Materials', description: 'Flooring' },
    { category: 'Fixtures & Fittings', description: 'Kitchen' },
    { category: 'Fixtures & Fittings', description: 'Bathroom' },
  ],
  'Compliance Upgrade': [
    { category: 'Materials', description: 'Fire doors' },
    { category: 'Materials', description: 'Fire alarm system' },
    { category: 'Materials', description: 'Emergency lighting' },
    { category: 'Labour', description: 'EICR remedial works' },
  ],
};
