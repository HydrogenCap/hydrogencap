import { FileText, Download } from 'lucide-react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Database } from '@/integrations/supabase/types';

type ReportRow = Database['public']['Tables']['investor_reports']['Row'];

export function ReportHistoryCard({
  reports,
  onGenerate,
  downloadInvestorReport,
  downloading,
}: {
  reports: ReportRow[] | undefined;
  onGenerate: () => void;
  downloadInvestorReport: (path: string, name: string) => Promise<void> | void;
  downloading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Report History</CardTitle>
        <Button size="sm" variant="outline" onClick={onGenerate}>
          <FileText className="h-4 w-4 mr-1" />Generate Statement
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Generated</TableHead>
              <TableHead>Sent</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(!reports || reports.length === 0) ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No reports generated yet</TableCell>
              </TableRow>
            ) : reports.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.title}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {format(new Date(r.report_period_from), 'MMM yyyy')} - {format(new Date(r.report_period_to), 'MMM yyyy')}
                </TableCell>
                <TableCell className="text-sm">{r.generated_at ? format(new Date(r.generated_at), 'dd MMM yyyy') : '-'}</TableCell>
                <TableCell>
                  {r.sent_to_investor ? (
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Sent</Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">Not sent</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {r.file_url && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={downloading}
                      onClick={() => void downloadInvestorReport(r.file_url, r.file_name || r.title)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
