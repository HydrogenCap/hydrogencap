import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, supabaseAny } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { fetchUserOrgId as getUserOrgId } from './useUserOrg';
import { useToast } from '@/hooks/use-toast';
import { createNotification } from '@/lib/createNotification';
import { logError } from '@/lib/errorLogger';
import type {
  MaintenanceCategory, MaintenancePriority, MaintenanceStatus,
  MaintenanceOverviewRow, ReportedBy,
} from '@/lib/maintenanceTypes';

// Re-export types for backwards compat
export type { MaintenanceCategory, MaintenancePriority, MaintenanceStatus };
export type MaintenanceUrgency = MaintenancePriority; // alias

type MaintenanceRequestInsert = Database['public']['Tables']['maintenance_requests']['Insert'];
type MaintenanceRequestUpdate = Database['public']['Tables']['maintenance_requests']['Update'];
type MaintenanceCommentInsert = Database['public']['Tables']['maintenance_comments']['Insert'];

const MAINTENANCE_SELECT = `
  *,
  property:properties(id, address_line, postcode),
  room:rooms(id, room_name),
  tenant:tenants(id, first_name, last_name, email, phone),
  property_v2:properties_v2(id, address_line_1, city, postcode),
  room_v2:rooms_v2(id, room_name),
  tenant_v2:tenants_v2(id, first_name, last_name, email, phone)
`;

export interface MaintenanceRequestWithDetails {
  id: string;
  org_id: string;
  property_id: string;
  room_id: string | null;
  tenant_id: string | null;
  property_v2_id: string | null;
  room_v2_id: string | null;
  tenant_v2_id: string | null;
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
  // Cost tracking
  estimated_cost: number | null;
  actual_cost: number | null;
  cost_approved_by: string | null;
  cost_approved_at: string | null;
  invoice_reference: string | null;
  // V1 joins (fallback)
  property: { id: string; address_line: string; postcode: string | null } | null;
  room?: { id: string; room_name: string } | null;
  tenant?: { id: string; first_name: string; last_name: string; email: string | null; phone: string | null } | null;
  // V2 joins (preferred)
  property_v2?: { id: string; address_line_1: string; city: string; postcode: string } | null;
  room_v2?: { id: string; room_name: string } | null;
  tenant_v2?: { id: string; first_name: string; last_name: string; email: string | null; phone: string | null } | null;
}

export function useMaintenanceRequests(filters?: {
  status?: MaintenanceStatus;
  priority?: MaintenancePriority;
  propertyId?: string;
  propertyV2Id?: string;
}) {
  return useQuery({
    queryKey: ['maintenance_requests', filters],
    queryFn: async () => {
      let query = supabaseAny
        .from('maintenance_requests')
        .select(MAINTENANCE_SELECT)
        .order('created_at', { ascending: false });

      if (filters?.status) query = query.eq('status', filters.status);
      if (filters?.priority) query = query.eq('priority', filters.priority);
      if (filters?.propertyId) query = query.eq('property_id', filters.propertyId);
      if (filters?.propertyV2Id) query = query.eq('property_v2_id', filters.propertyV2Id);

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
      const { data, error } = await supabaseAny
        .from('maintenance_overview' as never)
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
      const { data, error } = await supabaseAny
        .from('maintenance_requests')
        .select(MAINTENANCE_SELECT)
        .not('status', 'in', '("completed","verified","closed","cancelled")')
        .order('created_at', { ascending: true })
        .limit(200);

      if (error) throw error;
      return (data || []) as unknown as MaintenanceRequestWithDetails[];
    },
  });
}

export function useMaintenanceRequest(requestId: string | undefined) {
  return useQuery({
    queryKey: ['maintenance_requests', requestId],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('maintenance_requests')
        .select(MAINTENANCE_SELECT)
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
      property_id?: string | null;
      property_v2_id?: string | null;
      room_id?: string | null;
      room_v2_id?: string | null;
      tenant_id?: string | null;
      tenant_v2_id?: string | null;
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

      const requestPayload: MaintenanceRequestInsert = {
        ...request,
        org_id: orgId,
        reported_by: request.reported_by || 'operator',
        status: 'reported',
      };

      const { data, error } = await supabaseAny
        .from('maintenance_requests')
        .insert(requestPayload)
        .select()
        .single();

      if (error) throw error;

      // Auto-create system comment
      const commentPayload: MaintenanceCommentInsert = {
        org_id: orgId,
        maintenance_request_id: data.id,
        author_type: 'system',
        author_name: 'System',
        comment: `Issue reported by ${request.reported_by || 'operator'} on ${new Date().toLocaleDateString('en-GB')}`,
      };
      await supabase.from('maintenance_comments').insert(commentPayload);

      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['maintenance_requests'] });
      queryClient.invalidateQueries({ queryKey: ['maintenance_overview'] });
      toast({ title: 'Maintenance request created' });

      // Fire-and-forget notification
      if (data?.org_id) {
        createNotification({
          orgId: data.org_id,
          userId: 'all_org_members',
          category: 'maintenance',
          severity: variables.priority === 'emergency' ? 'critical' : 'info',
          title: 'New maintenance request',
          message: `${variables.title}`,
          linkTo: `/maintenance/${data.id}`,
          entityType: 'maintenance_request',
          entityId: data.id,
        }).catch((err) => {
          console.error('Failed to create maintenance notification:', err);
          logError({ source: 'useMaintenanceRequests.createNotification', message: 'Failed to create maintenance notification', severity: 'error', error: err });
        });
      }
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
    mutationFn: async ({ id, ...updates }: MaintenanceRequestUpdate & { id: string }) => {
      const { data, error } = await supabaseAny
        .from('maintenance_requests')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, _vars) => {
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

  const openRequests = requests.filter(r => !['completed', 'verified', 'closed', 'cancelled'].includes(r.status));
  const completedRequests = requests.filter(r => ['completed', 'verified', 'closed'].includes(r.status));

  // Calculate average resolution days for completed requests
  const resolutionDays = completedRequests
    .map(r => {
      const created = new Date(r.created_at).getTime();
      const updated = new Date(r.updated_at).getTime();
      return (updated - created) / (1000 * 60 * 60 * 24);
    })
    .filter(d => d > 0);

  return {
    total: requests.length,
    open: openRequests.length,
    emergency: openRequests.filter(r => r.is_emergency).length,
    completed: completedRequests.length,
    totalEstimatedCost: openRequests.reduce((sum, r) => sum + (r.estimated_cost || 0), 0),
    totalActualCost: completedRequests.reduce((sum, r) => sum + (r.actual_cost || 0), 0),
    avgResolutionDays: resolutionDays.length > 0
      ? Math.round(resolutionDays.reduce((a, b) => a + b, 0) / resolutionDays.length)
      : null,
  };
}
