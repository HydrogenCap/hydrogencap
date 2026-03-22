import { Download, FileText, Calendar } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PortalLayout } from '@/components/portal/PortalLayout';
import { usePortalInvestorData } from '@/hooks/usePortalInvestorData';
import { LoadingState } from '@/components/common/LoadingState';
import { useDownloadFile } from '@/hooks/useSignedUrl';
import type { Database } from '@/integrations/supabase/types';
import { format } from 'date-fns';

type InvestorReport = Database['public']['Tables']['investor_reports']['Row'];

export default function PortalStatements() {
  const { reports, isLoading } = usePortalInvestorData();
  const { download, downloading } = useDownloadFile('investor-reports');

  if (isLoading) {
    return (
      <PortalLayout>
        <LoadingState text="Loading statements..." />
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Statements & Reports</h1>
          <p className="text-muted-foreground">Download your investor statements and reports</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Report History</CardTitle>
            <CardDescription>
              {reports?.length ? `${reports.length} statement${reports.length !== 1 ? 's' : ''} available` : 'No statements generated yet'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {reports && reports.length > 0 ? (
              <div className="space-y-3">
                {(reports as InvestorReport[]).map((report) => (
                  <div
                    key={report.id}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{report.title || report.file_name}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {report.report_period_from && report.report_period_to
                              ? `${format(new Date(report.report_period_from), 'MMM yyyy')} – ${format(new Date(report.report_period_to), 'MMM yyyy')}`
                              : 'N/A'}
                          </span>
                          <span>
                            Generated {format(new Date(report.generated_at), 'dd MMM yyyy')}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="capitalize">
                        {(report.report_type || 'statement').replace(/_/g, ' ')}
                      </Badge>
                      {report.file_url ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={downloading}
                          onClick={() => void download(report.file_url, report.file_name || report.title || 'statement.pdf')}
                        >
                          <>
                            <Download className="mr-2 h-4 w-4" />
                            Download
                          </>
                        </Button>
                      ) : (
                        <Badge variant="secondary">Unavailable</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>No statements have been generated yet.</p>
                <p className="text-sm mt-1">Your fund manager will publish statements here when available.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
}
