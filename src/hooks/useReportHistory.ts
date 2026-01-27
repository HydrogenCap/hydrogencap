import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ReportHistoryItem {
  name: string;
  created_at: string;
  size: number;
  path: string;
  report_type: string;
  download_url?: string;
}

// Fetch report history from storage
export function useReportHistory() {
  return useQuery({
    queryKey: ['report_history'],
    queryFn: async () => {
      const reports: ReportHistoryItem[] = [];
      
      // List all report types
      const reportTypes = [
        'portfolio_compliance',
        'property_compliance_pack',
        'mortgage_broker_pack',
        'insurance_broker_pack',
      ];
      
      for (const reportType of reportTypes) {
        try {
          // List date folders within each report type
          const { data: dateFolders, error: folderError } = await supabase.storage
            .from('documents')
            .list(`reports/${reportType}`, { limit: 100, sortBy: { column: 'name', order: 'desc' } });
          
          if (folderError || !dateFolders) continue;
          
          // For each date folder, list files
          for (const folder of dateFolders.slice(0, 10)) { // Limit to recent 10 dates per type
            if (!folder.name || folder.id === null) continue; // Skip non-folders
            
            const { data: files, error: fileError } = await supabase.storage
              .from('documents')
              .list(`reports/${reportType}/${folder.name}`, { limit: 50 });
            
            if (fileError || !files) continue;
            
            for (const file of files) {
              if (!file.name.endsWith('.pdf')) continue;
              
              const path = `reports/${reportType}/${folder.name}/${file.name}`;
              
              // Get signed URL for download
              const { data: urlData } = await supabase.storage
                .from('documents')
                .createSignedUrl(path, 3600); // 1 hour
              
              reports.push({
                name: file.name,
                created_at: file.created_at || folder.name,
                size: file.metadata?.size || 0,
                path,
                report_type: reportType,
                download_url: urlData?.signedUrl,
              });
            }
          }
        } catch (err) {
          console.warn(`Failed to list reports for ${reportType}:`, err);
        }
      }
      
      // Sort by date descending
      return reports.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    },
    staleTime: 30000, // Cache for 30s
  });
}

// Delete a report from storage
export async function deleteReport(path: string): Promise<void> {
  const { error } = await supabase.storage
    .from('documents')
    .remove([path]);
  
  if (error) throw error;
}

// Get friendly report type name
export function getReportTypeName(reportType: string): string {
  const names: Record<string, string> = {
    portfolio_compliance: 'Portfolio Compliance Report',
    property_compliance_pack: 'Property Compliance Pack',
    mortgage_broker_pack: 'Mortgage Broker Pack',
    insurance_broker_pack: 'Insurance Broker Pack',
  };
  return names[reportType] || reportType;
}

// Format file size
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '—';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
