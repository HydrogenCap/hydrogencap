import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ValuationSummary {
  id: string;
  document_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  valuation_figure_gbp: number | null;
  valuation_date: string | null;
  surveyor_name: string | null;
  surveyor_firm: string | null;
  surveyor_rics_number: string | null;
  valuation_basis: string | null;
  tenure: string | null;
  property_type_noted: string | null;
  condition_rating: string | null;
  condition_notes: string | null;
  key_observations: string[];
  special_assumptions: string[];
  comparable_evidence: Array<{ address: string; price: number; date: string; notes: string }>;
  risk_factors: string[];
  recommended_actions: string[];
  gross_internal_area_sqft: number | null;
  price_per_sqft: number | null;
  executive_summary: string | null;
  ai_confidence: number | null;
  property_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PortfolioValuationRow {
  id: string;
  document_id: string;
  valuation_figure_gbp: number | null;
  valuation_date: string | null;
  surveyor_name: string | null;
  surveyor_firm: string | null;
  condition_rating: string | null;
  executive_summary: string | null;
  ai_confidence: number | null;
  property_id: string | null;
  property?: {
    id: string;
    address_line: string;
    postcode: string | null;
    current_value_gbp: number | null;
    beds: number | null;
    property_type: string | null;
  } | null;
  document?: {
    id: string;
    display_name: string | null;
    original_file_name: string;
    created_at: string;
  } | null;
}

export function useDocumentSummary(documentId: string | undefined) {
  return useQuery({
    queryKey: ['document-summary', documentId],
    queryFn: async () => {
      if (!documentId) return null;
      const { data, error } = await (supabase as any)
        .from('document_summaries')
        .select('*')
        .eq('document_id', documentId)
        .eq('summary_type', 'valuation')
        .maybeSingle();
      if (error) throw error;
      return data as unknown as ValuationSummary | null;
    },
    enabled: !!documentId,
  });
}

export function useTriggerDocumentSummary() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (documentId: string) => {
      const { data, error } = await supabase.functions.invoke('summarize-valuation-document', {
        body: { documentId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data, documentId) => {
      queryClient.invalidateQueries({ queryKey: ['document-summary', documentId] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-valuation-summaries'] });
      queryClient.invalidateQueries({ queryKey: ['document-vault'] });
      toast({
        title: 'Valuation Analysed',
        description: data?.valuation_figure
          ? `Valuation: £${Number(data.valuation_figure).toLocaleString()}`
          : 'Summary generated successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Analysis Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function usePortfolioValuationSummaries() {
  return useQuery({
    queryKey: ['portfolio-valuation-summaries'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('document_summaries')
        .select(`
          id, document_id, valuation_figure_gbp, valuation_date,
          surveyor_name, surveyor_firm, condition_rating,
          executive_summary, ai_confidence, property_id,
          property:properties(id, address_line, postcode, current_value_gbp, beds, property_type),
          document:documents(id, display_name, original_file_name, created_at)
        `)
        .eq('summary_type', 'valuation')
        .eq('status', 'completed')
        .order('valuation_date', { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data as unknown as PortfolioValuationRow[];
    },
    staleTime: 2 * 60_000,
  });
}
