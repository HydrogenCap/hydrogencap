import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import { toast } from 'sonner';

export interface ReportSection {
  heading: string;
  content: string;
  data: Record<string, unknown> | null;
}

export interface AIInvestorReport {
  id: string;
  org_id: string;
  title: string;
  report_type: 'quarterly' | 'annual' | 'custom';
  period_start: string;
  period_end: string;
  sections: ReportSection[];
  summary: string | null;
  generated_by: string | null;
  status: 'draft' | 'published';
  published_at: string | null;
  recipients: { investor_id: string }[];
  created_at: string;
  updated_at: string;
}

export interface GenerateReportParams {
  report_type: 'quarterly' | 'annual' | 'custom';
  period_start: string;
  period_end: string;
  investor_ids?: string[];
  custom_sections?: string[];
}

export interface GenerateReportResponse {
  success: boolean;
  report: AIInvestorReport;
  metrics: Record<string, unknown>;
}

// List all AI investor reports for the org
export function useAIInvestorReports() {
  const { data: org } = useOrganization();

  return useQuery({
    queryKey: ['ai_investor_reports', org?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_investor_reports')
        .select('*')
        .eq('org_id', org!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as AIInvestorReport[];
    },
    enabled: !!org?.id,
    staleTime: 5 * 60 * 1000,
  });
}

// Fetch a single report by ID
export function useAIReportDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['ai_investor_report', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_investor_reports')
        .select('*')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data as unknown as AIInvestorReport;
    },
    enabled: !!id,
  });
}

// Trigger report generation via edge function
export function useGenerateAIReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: GenerateReportParams): Promise<GenerateReportResponse> => {
      const { data, error } = await supabase.functions.invoke('generate-investor-report', {
        body: params,
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as GenerateReportResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai_investor_reports'] });
      toast.success('Investor report generated successfully');
    },
    onError: (error: Error) => {
      if (error.message.includes('Rate limit')) {
        toast.error('Rate limit exceeded. Please try again in a moment.');
      } else if (error.message.includes('credits')) {
        toast.error('AI credits exhausted. Please add credits to continue.');
      } else {
        toast.error(`Failed to generate report: ${error.message}`);
      }
    },
  });
}

// Publish a report
export function usePublishAIReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('ai_investor_reports')
        .update({
          status: 'published',
          published_at: new Date().toISOString(),
        } as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as AIInvestorReport;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ai_investor_reports'] });
      queryClient.invalidateQueries({ queryKey: ['ai_investor_report', data.id] });
      toast.success('Report published');
    },
    onError: () => {
      toast.error('Failed to publish report');
    },
  });
}

// Update a single section of a report
export function useUpdateAIReportSection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      reportId,
      sectionIndex,
      updatedSection,
    }: {
      reportId: string;
      sectionIndex: number;
      updatedSection: Partial<ReportSection>;
    }) => {
      // Fetch current report to get all sections
      const { data: report, error: fetchError } = await supabase
        .from('ai_investor_reports')
        .select('sections')
        .eq('id', reportId)
        .single();

      if (fetchError) throw fetchError;

      const sections = [...(report.sections as unknown as ReportSection[])];
      sections[sectionIndex] = { ...sections[sectionIndex], ...updatedSection };

      const { data, error } = await supabase
        .from('ai_investor_reports')
        .update({ sections } as any)
        .eq('id', reportId)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as AIInvestorReport;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ai_investor_reports'] });
      queryClient.invalidateQueries({ queryKey: ['ai_investor_report', data.id] });
      toast.success('Section updated');
    },
    onError: () => {
      toast.error('Failed to update section');
    },
  });
}
