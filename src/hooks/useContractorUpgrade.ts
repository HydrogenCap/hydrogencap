import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { fetchUserOrgId, useUserOrg } from '@/hooks/useUserOrg';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface JobQuote {
  id: string;
  job_id: string;
  contractor_id: string;
  org_id: string;
  amount: number;
  description: string | null;
  valid_until: string | null;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  attachments: unknown[];
  submitted_at: string;
  responded_at: string | null;
  created_at: string;
  contractor?: {
    id: string;
    name: string;
    company_name: string | null;
    average_rating: number;
    avg_response_hours: number | null;
  };
}

export interface JobEvidence {
  id: string;
  job_id: string;
  org_id: string;
  evidence_type: 'before_photo' | 'during_photo' | 'after_photo' | 'receipt' | 'invoice' | 'certificate' | 'other';
  file_url: string;
  description: string | null;
  taken_at: string;
  uploaded_by: string | null;
  created_at: string;
}

export interface ContractorRating {
  id: string;
  contractor_id: string;
  job_id: string;
  org_id: string;
  rating: number;
  quality_score: number | null;
  timeliness_score: number | null;
  communication_score: number | null;
  value_score: number | null;
  review_text: string | null;
  created_at: string;
}

// ── Job Quotes ─────────────────────────────────────────────────────────────────

export function useJobQuotes(jobId: string | undefined) {
  return useQuery({
    queryKey: ['job-quotes', jobId],
    queryFn: async () => {
      if (!jobId) return [];

      const { data, error } = await (supabase as any)
        .from('job_quotes')
        .select(`
          *,
          contractor:contractors(id, name, company_name, average_rating, avg_response_hours)
        `)
        .eq('job_id', jobId)
        .order('amount', { ascending: true });

      if (error) throw error;
      return data as JobQuote[];
    },
    enabled: !!jobId,
  });
}

export function useRequestQuote() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (quote: {
      jobId: string;
      contractorId: string;
      amount: number;
      description?: string;
      validUntil?: string;
    }) => {
      const orgId = await fetchUserOrgId();

      const { data, error } = await (supabase as any)
        .from('job_quotes')
        .insert({
          job_id: quote.jobId,
          contractor_id: quote.contractorId,
          org_id: orgId,
          amount: quote.amount,
          description: quote.description || null,
          valid_until: quote.validUntil || null,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['job-quotes', variables.jobId] });
      toast({ title: 'Quote requested' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to request quote', description: error.message, variant: 'destructive' });
    },
  });
}

export function useRespondToQuote() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ quoteId, jobId, status }: { quoteId: string; jobId: string; status: 'accepted' | 'rejected' }) => {
      const { data, error } = await (supabase as any)
        .from('job_quotes')
        .update({
          status,
          responded_at: new Date().toISOString(),
        })
        .eq('id', quoteId)
        .select()
        .single();

      if (error) throw error;

      // If accepted, reject all other pending quotes for this job
      if (status === 'accepted') {
        await (supabase as any)
          .from('job_quotes')
          .update({ status: 'rejected', responded_at: new Date().toISOString() })
          .eq('job_id', jobId)
          .eq('status', 'pending')
          .neq('id', quoteId);
      }

      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['job-quotes', variables.jobId] });
      queryClient.invalidateQueries({ queryKey: ['contractor-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job-counts'] });
      toast({ title: variables.status === 'accepted' ? 'Quote accepted' : 'Quote rejected' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update quote', description: error.message, variant: 'destructive' });
    },
  });
}

// ── Job Evidence ───────────────────────────────────────────────────────────────

export function useJobEvidence(jobId: string | undefined) {
  return useQuery({
    queryKey: ['job-evidence', jobId],
    queryFn: async () => {
      if (!jobId) return [];

      const { data, error } = await (supabase as any)
        .from('job_evidence')
        .select('*')
        .eq('job_id', jobId)
        .order('taken_at', { ascending: true });

      if (error) throw error;
      return data as JobEvidence[];
    },
    enabled: !!jobId,
  });
}

export function useUploadEvidence() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (evidence: {
      jobId: string;
      evidenceType: JobEvidence['evidence_type'];
      fileUrl: string;
      description?: string;
    }) => {
      const orgId = await fetchUserOrgId();
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await (supabase as any)
        .from('job_evidence')
        .insert({
          job_id: evidence.jobId,
          org_id: orgId,
          evidence_type: evidence.evidenceType,
          file_url: evidence.fileUrl,
          description: evidence.description || null,
          uploaded_by: user?.id || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['job-evidence', variables.jobId] });
      toast({ title: 'Evidence uploaded' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to upload evidence', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteEvidence() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, jobId }: { id: string; jobId: string }) => {
      const { error } = await (supabase as any)
        .from('job_evidence')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['job-evidence', variables.jobId] });
      toast({ title: 'Evidence removed' });
    },
  });
}

// ── Contractor Ratings ─────────────────────────────────────────────────────────

export function useContractorRatings(contractorId: string | undefined) {
  return useQuery({
    queryKey: ['contractor-ratings', contractorId],
    queryFn: async () => {
      if (!contractorId) return [];

      const { data, error } = await (supabase as any)
        .from('contractor_ratings')
        .select('*')
        .eq('contractor_id', contractorId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ContractorRating[];
    },
    enabled: !!contractorId,
  });
}

export function useRateContractor() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (rating: {
      contractorId: string;
      jobId: string;
      rating: number;
      qualityScore?: number;
      timelinessScore?: number;
      communicationScore?: number;
      valueScore?: number;
      reviewText?: string;
    }) => {
      const orgId = await fetchUserOrgId();

      const { data, error } = await (supabase as any)
        .from('contractor_ratings')
        .insert({
          contractor_id: rating.contractorId,
          job_id: rating.jobId,
          org_id: orgId,
          rating: rating.rating,
          quality_score: rating.qualityScore || null,
          timeliness_score: rating.timelinessScore || null,
          communication_score: rating.communicationScore || null,
          value_score: rating.valueScore || null,
          review_text: rating.reviewText || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Update contractor's avg_rating
      const { data: allRatings } = await (supabase as any)
        .from('contractor_ratings')
        .select('rating')
        .eq('contractor_id', rating.contractorId);

      if (allRatings && allRatings.length > 0) {
        const avgRating = allRatings.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) / allRatings.length;
        await (supabase as any)
          .from('contractors')
          .update({ avg_rating: Math.round(avgRating * 10) / 10 })
          .eq('id', rating.contractorId);
      }

      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['contractor-ratings', variables.contractorId] });
      queryClient.invalidateQueries({ queryKey: ['contractors'] });
      queryClient.invalidateQueries({ queryKey: ['contractor', variables.contractorId] });
      toast({ title: 'Rating submitted' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to submit rating', description: error.message, variant: 'destructive' });
    },
  });
}
