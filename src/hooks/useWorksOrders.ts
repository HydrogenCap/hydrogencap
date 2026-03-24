import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchUserOrgId as getUserOrgId } from './useUserOrg';
import { useToast } from '@/hooks/use-toast';
import type { WorksOrderStatus } from '@/lib/maintenanceTypes';

export interface WorksOrder {
  id: string;
  org_id: string;
  maintenance_request_id: string;
  property_id: string;
  contractor_id: string | null;
  contractor_name_override: string | null;
  contractor_phone_override: string | null;
  contractor_email_override: string | null;
  order_number: string | null;
  description: string;
  status: WorksOrderStatus;
  quoted_amount: number | null;
  approved_amount: number | null;
  invoice_amount: number | null;
  paid_amount: number | null;
  quote_date: string | null;
  approval_date: string | null;
  scheduled_date: string | null;
  scheduled_time_slot: string | null;
  scheduled_time: string | null;
  completion_date: string | null;
  invoice_reference: string | null;
  invoice_date: string | null;
  paid_date: string | null;
  payment_method: string | null;
  tenant_access_required: boolean;
  tenant_notified: boolean;
  tenant_notification_date: string | null;
  warranty_months: number | null;
  warranty_expiry: string | null;
  completion_notes: string | null;
  completion_photo_urls: string[] | null;
  before_photo_urls: string[] | null;
  after_photo_urls: string[] | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorksOrderWithContractor extends WorksOrder {
  contractor?: {
    id: string;
    company_name: string;
    contact_name: string | null;
    email: string | null;
    phone: string | null;
    rating: number | null;
    service_types: string[];
  } | null;
}

interface WorksOrderInsert {
  maintenance_request_id: string;
  property_id: string;
  description: string;
  contractor_id?: string | null;
  contractor_name_override?: string | null;
  contractor_phone_override?: string | null;
  contractor_email_override?: string | null;
  tenant_access_required?: boolean;
  notes?: string | null;
}

interface MaintenanceCommentInsert {
  org_id: string;
  maintenance_request_id: string;
  author_type: 'system';
  author_name: string;
  comment: string;
}

type WorksOrderUpdate = Partial<WorksOrder> & Record<string, unknown>;

export function useWorksOrdersForRequest(requestId: string | undefined) {
  return useQuery({
    queryKey: ['works_orders', 'request', requestId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_orders')
        .select(`
          *,
          contractor:compliance_contractors_v2(id, company_name, contact_name, email, phone, rating, service_types)
        `)
        .eq('maintenance_request_id', requestId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as WorksOrderWithContractor[];
    },
    enabled: !!requestId,
  });
}

export function useWorksOrder(orderId: string | undefined) {
  return useQuery({
    queryKey: ['works_orders', orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_orders')
        .select(`
          *,
          contractor:compliance_contractors_v2(id, company_name, contact_name, email, phone, rating, service_types)
        `)
        .eq('id', orderId!)
        .single();
      if (error) throw error;
      return data as unknown as WorksOrderWithContractor;
    },
    enabled: !!orderId,
  });
}

export function useCreateWorksOrder() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (order: WorksOrderInsert) => {
      const orgId = await getUserOrgId();
      if (!orgId) throw new Error('No organization found');

      // Generate order number
      const { data: orderNumber } = await supabase.rpc('generate_works_order_number');

      const { data, error } = await supabase
        .from('work_orders')
        .insert({
          ...order,
          org_id: orgId,
          wo_number: orderNumber ?? '',
          entity_id: (order as any).entity_id ?? orgId,
          status: 'draft',
        } as any)
        .select()
        .single();

      if (error) throw error;

      // Update request status to triaged
      await supabase
        .from('maintenance_requests')
        .update({ status: 'triaged' })
        .eq('id', order.maintenance_request_id);

      // Add system comment
      const contractorName = order.contractor_name_override || 'contractor';
      const comment: MaintenanceCommentInsert = {
        org_id: orgId,
        maintenance_request_id: order.maintenance_request_id,
        author_type: 'system',
        author_name: 'System',
        comment: `Works order ${orderNumber} created${order.contractor_id ? ` and assigned to ${contractorName}` : ''}`,
      };
      await supabase.from('maintenance_comments').insert({
        ...comment,
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['works_orders'] });
      queryClient.invalidateQueries({ queryKey: ['maintenance_requests'] });
      queryClient.invalidateQueries({ queryKey: ['maintenance_overview'] });
      toast({ title: 'Works order created' });
    },
    onError: (error) => {
      toast({ title: 'Failed to create works order', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateWorksOrder() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & WorksOrderUpdate) => {
      const { data, error } = await supabase
        .from('work_orders')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['works_orders'] });
      queryClient.invalidateQueries({ queryKey: ['maintenance_requests'] });
      queryClient.invalidateQueries({ queryKey: ['maintenance_overview'] });
      toast({ title: 'Works order updated' });
    },
    onError: (error) => {
      toast({ title: 'Failed to update works order', description: error.message, variant: 'destructive' });
    },
  });
}
