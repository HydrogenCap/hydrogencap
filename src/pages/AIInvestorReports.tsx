import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Plus,
  Search,
  FileText,
  Loader2,
  Eye,
  Send,
  Sparkles,
} from 'lucide-react';
import {
  useAIInvestorReports,
  useGenerateAIReport,
  usePublishAIReport,
  type AIInvestorReport,
  type GenerateReportParams,
} from '@/hooks/useAIInvestorReports';
import { useInvestors } from '@/hooks/useInvestors';
import { ReportPreview } from '@/components/reports/ReportPreview';

function GenerateReportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const generateReport = useGenerateAIReport();
  const { data: investors } = useInvestors();

  const [form, setForm] = useState<GenerateReportParams>({
    report_type: 'quarterly',
    period_start: '',
    period_end: '',
    investor_ids: [],
  });

  const [selectedInvestors, setSelectedInvestors] = useState<string[]>([]);

  const handleSubmit = async () => {
    if (!form.period_start || !form.period_end) return;

    await generateReport.mutateAsync({
      ...form,
      investor_ids: selectedInvestors.length > 0 ? selectedInvestors : undefined,
    });
    onOpenChange(false);
    setForm({ report_type: 'quarterly', period_start: '', period_end: '', investor_ids: [] });
    setSelectedInvestors([]);
  };

  const toggleInvestor = (id: string) => {
    setSelectedInvestors(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // Calculate default periods
  const now = new Date();
  const currentQuarter = Math.ceil((now.getMonth() + 1) / 3);
  const quarterStart = new Date(now.getFullYear(), (currentQuarter - 2) * 3, 1);
  const quarterEnd = new Date(now.getFullYear(), (currentQuarter - 1) * 3, 0);

  const setQuarterlyDefaults = () => {
    setForm(prev => ({
      ...prev,
      report_type: 'quarterly',
      period_start: quarterStart.toISOString().split('T')[0],
      period_end: quarterEnd.toISOString().split('T')[0],
    }));
  };

  const setAnnualDefaults = () => {
    const yearStart = new Date(now.getFullYear() - 1, 0, 1);
    const yearEnd = new Date(now.getFullYear() - 1, 11, 31);
    setForm(prev => ({
      ...prev,
      report_type: 'annual',
      period_start: yearStart.toISOString().split('T')[0],
      period_end: yearEnd.toISOString().split('T')[0],
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Generate AI Investor Report
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Report Type</Label>
            <Select
              value={form.report_type}
              onValueChange={(value) => {
                setForm(prev => ({ ...prev, report_type: value as GenerateReportParams['report_type'] }));
                if (value === 'quarterly') setQuarterlyDefaults();
                if (value === 'annual') setAnnualDefaults();
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="quarterly">Quarterly</SelectItem>
                <SelectItem value="annual">Annual</SelectItem>
                <SelectItem value="custom">Custom Period</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Period Start</Label>
              <Input
                type="date"
                value={form.period_start}
                onChange={(e) => setForm(prev => ({ ...prev, period_start: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Period End</Label>
              <Input
                type="date"
                value={form.period_end}
                onChange={(e) => setForm(prev => ({ ...prev, period_end: e.target.value }))}
              />
            </div>
          </div>

          {investors && investors.length > 0 && (
            <div className="space-y-2">
              <Label>Target Investors (optional)</Label>
              <div className="max-h-32 overflow-y-auto border rounded-md p-2 space-y-1">
                {investors.map((inv) => (
                  <label
                    key={inv.id}
                    className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 p-1 rounded"
                  >
                    <input
                      type="checkbox"
                      checked={selectedInvestors.includes(inv.id)}
                      onChange={() => toggleInvestor(inv.id)}
                      className="rounded"
                    />
                    <span>{inv.investor_name}</span>
                    {inv.investor_type && (
                      <Badge variant="outline" className="text-xs ml-auto">
                        {inv.investor_type}
                      </Badge>
                    )}
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Leave empty to generate for all investors
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={generateReport.isPending || !form.period_start || !form.period_end}
          >
            {generateReport.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Report
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AIInvestorReports() {
  const { data: reports, isLoading } = useAIInvestorReports();
  const publishReport = usePublishAIReport();
  const [search, setSearch] = useState('');
  const [showGenerate, setShowGenerate] = useState(false);
  const [selectedReport, setSelectedReport] = useState<AIInvestorReport | null>(null);

  const filtered = useMemo(() => {
    if (!reports) return [];
    if (!search) return reports;
    const q = search.toLowerCase();
    return reports.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.report_type.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q)
    );
  }, [reports, search]);

  const handlePublish = (id: string) => {
    publishReport.mutate(id);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">AI Investor Reports</h1>
            <p className="text-muted-foreground">
              Generate and manage AI-powered investor reports
            </p>
          </div>
          <Button onClick={() => setShowGenerate(true)}>
            <Sparkles className="h-4 w-4 mr-2" />
            Generate Report
          </Button>
        </div>

        {/* Search */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search reports..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">No investor reports yet</p>
            <p className="text-sm mt-1">
              Generate your first AI-powered investor report
            </p>
            <Button className="mt-4" onClick={() => setShowGenerate(true)}>
              <Sparkles className="h-4 w-4 mr-2" />
              Generate Report
            </Button>
          </div>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((report) => (
                  <TableRow
                    key={report.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedReport(report)}
                  >
                    <TableCell className="font-semibold max-w-[300px] truncate">
                      {report.title}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {report.report_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {report.period_start} to {report.period_end}
                    </TableCell>
                    <TableCell>
                      <Badge variant={report.status === 'published' ? 'default' : 'secondary'}>
                        {report.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(report.created_at).toLocaleDateString('en-GB')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedReport(report)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {report.status === 'draft' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePublish(report.id)}
                            disabled={publishReport.isPending}
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Generate Dialog */}
      <GenerateReportDialog open={showGenerate} onOpenChange={setShowGenerate} />

      {/* Report Preview Sheet */}
      <Sheet open={!!selectedReport} onOpenChange={(open) => !open && setSelectedReport(null)}>
        <SheetContent className="sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center justify-between">
              <span>Report Preview</span>
              {selectedReport?.status === 'draft' && (
                <Button
                  size="sm"
                  onClick={() => selectedReport && handlePublish(selectedReport.id)}
                  disabled={publishReport.isPending}
                >
                  {publishReport.isPending ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-1" />
                  )}
                  Publish
                </Button>
              )}
            </SheetTitle>
          </SheetHeader>
          {selectedReport && (
            <div className="mt-4">
              <ReportPreview report={selectedReport} />
            </div>
          )}
          <div className="mt-6 text-xs text-muted-foreground border-t pt-4">
            Future: PDF export coming soon
          </div>
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}
