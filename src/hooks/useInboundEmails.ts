import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface InboundEmail {
  id: string;
  org_id: string;
  message_id: string | null;
  from_email: string;
  from_name: string | null;
  to_email: string;
  subject: string | null;
  body_text: string | null;
  received_at: string;
  attachments: {
    filename: string;
    content_type: string;
    size_bytes: number;
    storage_url?: string;
  }[];
  processing_status: 'pending' | 'processing' | 'processed' | 'failed' | 'manual_review';
  processed_at: string | null;
  processing_error: string | null;
  ai_extraction: {
    certificate_type?: string;
    property_address?: string;
    postcode?: string;
    issue_date?: string;
    expiry_date?: string;
    confidence_score?: number;
    engineer_name?: string;
    company_name?: string;
    certificate_number?: string;
  } | null;
  matched_property_id: string | null;
  matched_job_id: string | null;
  matched_compliance_item_id: string | null;
  match_confidence: 'high' | 'medium' | 'low' | 'none' | null;
  document_created_id: string | null;
  compliance_updated: boolean;
  job_updated: boolean;
  requires_review: boolean;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
  // Joined data
  matched_property?: {
    id: string;
    address_line: string;
    postcode: string | null;
  };
  matched_job?: {
    id: string;
    job_type: string;
    status: string;
  };
}

export function useInboundEmails(filters?: {
  status?: string;
  requiresReview?: boolean;
}) {
  return useQuery({
    queryKey: ['inbound-emails', filters],
    queryFn: async () => {
      let query = supabase
        .from('inbound_emails')
        .select(`
          *,
          matched_property:properties(id, address_line, postcode),
          matched_job:contractor_jobs(id, job_type, status)
        `)
        .order('received_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('processing_status', filters.status);
      }

      if (filters?.requiresReview === true) {
        query = query.eq('requires_review', true);
      }

      const { data, error } = await query.limit(200);
      if (error) throw error;
      return data as unknown as InboundEmail[];
    },
  });
}

export function useInboundEmailStats() {
  return useQuery({
    queryKey: ['inbound-email-stats'],
    queryFn: async () => {
      const [total, pending, processing, processed, failed, needsReview] = await Promise.all([
        supabase.from('inbound_emails').select('*', { count: 'exact', head: true }),
        supabase.from('inbound_emails').select('*', { count: 'exact', head: true }).eq('processing_status', 'pending'),
        supabase.from('inbound_emails').select('*', { count: 'exact', head: true }).eq('processing_status', 'processing'),
        supabase.from('inbound_emails').select('*', { count: 'exact', head: true }).eq('processing_status', 'processed'),
        supabase.from('inbound_emails').select('*', { count: 'exact', head: true }).eq('processing_status', 'failed'),
        supabase.from('inbound_emails').select('*', { count: 'exact', head: true }).eq('requires_review', true),
      ]);

      return {
        total: total.count ?? 0,
        pending: pending.count ?? 0,
        processing: processing.count ?? 0,
        processed: processed.count ?? 0,
        failed: failed.count ?? 0,
        needsReview: needsReview.count ?? 0,
      };
    },
  });
}

export function useUpdateInboundEmail() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      id, 
      ...updates 
    }: { 
      id: string;
      matched_property_id?: string | null;
      matched_job_id?: string | null;
      processing_status?: string;
      review_notes?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('inbound_emails')
        .update({
          ...updates,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbound-emails'] });
      queryClient.invalidateQueries({ queryKey: ['inbound-email-stats'] });
      toast({ title: 'Email updated' });
    },
  });
}

// Reprocess a failed or pending email
export function useReprocessEmail() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (emailId: string) => {
      // This would call an edge function to reprocess
      // For now, just mark as pending
      const { error } = await supabase
        .from('inbound_emails')
        .update({ 
          processing_status: 'pending',
          processing_error: null,
        })
        .eq('id', emailId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbound-emails'] });
      toast({ title: 'Email queued for reprocessing' });
    },
  });
}
