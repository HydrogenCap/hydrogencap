import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useUserOrg } from '@/hooks/useUserOrg';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { InvestorStatementReport, type InvestorReportData } from '@/lib/investorReportGenerator';

type InvestorReportInsert = Database['public']['Tables']['investor_reports']['Insert'];

export function useInvestorReports(investorId: string | undefined) {
  return useQuery({
    queryKey: ['investor-reports', investorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('investor_reports')
        .select('*')
        .eq('investor_id', investorId!)
        .order('generated_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!investorId,
  });
}

export function useGenerateInvestorReport() {
  const queryClient = useQueryClient();
  const { data: orgId } = useUserOrg();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      reportData,
      reportType,
      investorId,
    }: {
      reportData: InvestorReportData;
      reportType: string;
      investorId: string;
    }) => {
      // Generate PDF
      const report = new InvestorStatementReport(reportData);
      report.generate();
      const blob = report.getBlob();

      const dateStr = format(new Date(), 'yyyy-MM-dd');
      const timestamp = format(new Date(), 'HHmmss');
      const safeName = reportData.investor.investor_name.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `Investor_Statement_${safeName}_${dateStr}_${timestamp}.pdf`;

      // Upload to storage
      const storagePath = `investor-reports/${dateStr}/${filename}`;
      const { error: uploadError } = await supabase.storage
        .from('investor-reports')
        .upload(storagePath, blob, { contentType: 'application/pdf', upsert: true });

      let fileUrl: string | null = null;
      if (!uploadError) {
        // Store the storage object path so downloads can always be re-signed.
        fileUrl = storagePath;
      } else {
        console.warn('Failed to upload investor report:', uploadError);
      }

      // Save report record
      const { error: insertError } = await supabase
        .from('investor_reports')
        .insert({
          org_id: orgId!,
          investor_id: investorId,
          report_type: reportType,
          report_period_from: format(reportData.reportPeriod.from, 'yyyy-MM-dd'),
          report_period_to: format(reportData.reportPeriod.to, 'yyyy-MM-dd'),
          title: `Investor Statement – ${format(reportData.reportPeriod.from, 'MMM yyyy')} to ${format(reportData.reportPeriod.to, 'MMM yyyy')}`,
          file_url: fileUrl,
          file_name: filename,
          generated_at: new Date().toISOString(),
        } as InvestorReportInsert);

      if (insertError) {
        console.warn('Failed to save report record:', insertError);
      }

      // Trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      return { success: true, filename };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['investor-reports'] });
      toast({ title: 'Report generated', description: 'Your investor statement has been downloaded.' });
    },
    onError: (err: Error) => {
      toast({ title: 'Report generation failed', description: err.message, variant: 'destructive' });
    },
  });
}
