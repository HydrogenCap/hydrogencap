import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchUserOrgId as getUserOrgId } from './useUserOrg';
import { useToast } from '@/hooks/use-toast';
import type {
  MaintenanceCategory, MaintenancePriority, MaintenanceStatus,
  MaintenanceOverviewRow, ReportedBy,
} from '@/lib/maintenanceTypes';

// Re-export types for backwards compat
export type { MaintenanceCategory, MaintenancePriority, MaintenanceStatus };
export type MaintenanceUrgency = MaintenancePriority; // alias

export interface MaintenanceRequestWithDetails {
  id: string;
  org_id: string;
  property_id: string;
  room_id: string | null;
  tenant_id: string | null;
  reported_by: ReportedBy;
  category: MaintenanceCategory;
  priority: MaintenancePriority;
  title: string;
  description: string | null;
  location_detail: string | null;
  photo_urls: string[] | null;
  reported_date: string;
  status: MaintenanceStatus;
  is_emergency: boolean;
  is_recurring: boolean;
  linked_request_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  property: { id: string; address_line: string; postcode: string | null };
  room?: { id: string; room_name: string } | null;
  tenant?: { id: string; first_name: string; last_name: string; email: string | null; phone: string | null } | null;
}

export function useMaintenanceRequests(filters?: {
  status?: MaintenanceStatus;
  priority?: MaintenancePriority;
  propertyId?: string;
}) {
  return useQuery({
    queryKey: ['maintenance_requests', filters],
    queryFn: async () => {
      let query = supabase
        .from('maintenance_requests')
        .select(`
          *,
          property:properties(id, address_line, postcode),
          room:rooms(id, room_name),
          tenant:tenants(id, first_name, last_name, email, phone)
        `)
        .order('created_at', { ascending: false });

      if (filters?.status) query = query.eq('status', filters.status);
      if (filters?.priority) query = query.eq('priority', filters.priority);
      if (filters?.propertyId) query = query.eq('property_id', filters.propertyId);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as MaintenanceRequestWithDetails[];
    },
  });
}

export function useMaintenanceOverview() {
  return useQuery({
    queryKey: ['maintenance_overview'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('maintenance_overview' as any)
        .select('*');
      if (error) throw error;
      return (data || []) as unknown as MaintenanceOverviewRow[];
    },
  });
}

export function useOpenMaintenanceRequests() {
  return useQuery({
    queryKey: ['maintenance_requests', 'open'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('maintenance_requests')
        .select(`
          *,
          property:properties(id, address_line, postcode),
          room:rooms(id, room_name),
          tenant:tenants(id, first_name, last_name)
        `)
        .not('status', 'in', '("completed","verified","closed","cancelled")')
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []) as unknown as MaintenanceRequestWithDetails[];
    },
  });
}

export function useMaintenanceRequest(requestId: string | undefined) {
  return useQuery({
    queryKey: ['maintenance_requests', requestId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('maintenance_requests')
        .select(`
          *,
          property:properties(id, address_line, postcode),
          room:rooms(id, room_name),
          tenant:tenants(id, first_name, last_name, email, phone)
        `)
        .eq('id', requestId!)
        .single();
      if (error) throw error;
      return data as unknown as MaintenanceRequestWithDetails;
    },
    enabled: !!requestId,
  });
}

export function useCreateMaintenanceRequest() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (request: {
      property_id: string;
      room_id?: string | null;
      tenant_id?: string | null;
      category: string;
      priority: string;
      title: string;
      description: string;
      location_detail?: string | null;
      reported_by?: string;
      notes?: string | null;
      photo_urls?: string[] | null;
    }) => {
      const orgId = await getUserOrgId();
      if (!orgId) throw new Error('No organization found');

      const { data, error } = await supabase
        .from('maintenance_requests')
        .insert({
          ...request,
          org_id: orgId,
          status: 'reported',
        } as any)
        .select()
        .single();

      if (error) throw error;

      // Auto-create system comment
      await supabase.from('maintenance_comments').insert({
        org_id: orgId,
        maintenance_request_id: data.id,
        author_type: 'system',
        author_name: 'System',
        comment: `Issue reported by ${request.reported_by || 'operator'} on ${new Date().toLocaleDateString('en-GB')}`,
      } as any);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance_requests'] });
      queryClient.invalidateQueries({ queryKey: ['maintenance_overview'] });
      toast({ title: 'Maintenance request created' });
    },
    onError: (error) => {
      toast({ title: 'Failed to create request', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateMaintenanceRequest() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [key: string]: any }) => {
      const { data, error } = await supabase
        .from('maintenance_requests')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['maintenance_requests'] });
      queryClient.invalidateQueries({ queryKey: ['maintenance_overview'] });
      toast({ title: 'Request updated' });
    },
    onError: (error) => {
      toast({ title: 'Failed to update request', description: error.message, variant: 'destructive' });
    },
  });
}

export function useMaintenanceStats() {
  const { data: requests } = useMaintenanceRequests();
  if (!requests) return null;
  return {
    total: requests.length,
    open: requests.filter(r => !['completed', 'verified', 'closed', 'cancelled'].includes(r.status)).length,
    emergency: requests.filter(r => r.is_emergency && !['completed', 'verified', 'closed', 'cancelled'].includes(r.status)).length,
    completed: requests.filter(r => ['completed', 'verified', 'closed'].includes(r.status)).length,
  };
}
