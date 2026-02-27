import { useState } from 'react';
import { format, startOfYear, endOfMonth, subYears, startOfMonth } from 'date-fns';
import { FileText, Download, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useGenerateInvestorReport } from '@/hooks/useInvestorReports';
import type { InvestorReportData } from '@/lib/investorReportGenerator';
import type { Investor } from '@/hooks/useInvestors';

interface InvestorReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  investor: Investor & { id: string };
  commitments: any[];
  distributions: any[];
  returnMetrics: any[];
}

export function InvestorReportModal({
  open, onOpenChange, investor, commitments, distributions, returnMetrics,
}: InvestorReportModalProps) {
  const now = new Date();
  const [periodPreset, setPeriodPreset] = useState('ytd');
  const [periodFrom, setPeriodFrom] = useState(format(startOfYear(now), 'yyyy-MM-dd'));
  const [periodTo, setPeriodTo] = useState(format(now, 'yyyy-MM-dd'));
  const [preparedBy, setPreparedBy] = useState('');

  const generateMutation = useGenerateInvestorReport();

  const handlePresetChange = (preset: string) => {
    setPeriodPreset(preset);
    switch (preset) {
      case 'ytd':
        setPeriodFrom(format(startOfYear(now), 'yyyy-MM-dd'));
        setPeriodTo(format(now, 'yyyy-MM-dd'));
        break;
      case 'last_year':
        setPeriodFrom(format(startOfYear(subYears(now, 1)), 'yyyy-MM-dd'));
        setPeriodTo(format(new Date(now.getFullYear() - 1, 11, 31), 'yyyy-MM-dd'));
        break;
      case 'last_quarter': {
        const qMonth = Math.floor((now.getMonth() - 3) / 3) * 3 + (now.getMonth() >= 3 ? 0 : -9);
        const qStart = new Date(now.getFullYear() + (qMonth < 0 ? -1 : 0), (qMonth + 12) % 12, 1);
        const qEnd = endOfMonth(new Date(qStart.getFullYear(), qStart.getMonth() + 2, 1));
        setPeriodFrom(format(qStart, 'yyyy-MM-dd'));
        setPeriodTo(format(qEnd, 'yyyy-MM-dd'));
        break;
      }
      case 'last_12':
        setPeriodFrom(format(startOfMonth(subYears(now, 1)), 'yyyy-MM-dd'));
        setPeriodTo(format(now, 'yyyy-MM-dd'));
        break;
      case 'custom':
        break;
    }
  };

  const handleGenerate = () => {
    const reportData: InvestorReportData = {
      investor: {
        investor_name: investor.investor_name,
        investor_type: investor.investor_type,
        email: investor.email,
        phone: investor.phone,
        accredited_investor: investor.accredited_investor,
        kyc_completed: investor.kyc_completed,
      },
      commitments: commitments || [],
      distributions: distributions || [],
      returnMetrics: returnMetrics || [],
      reportPeriod: { from: new Date(periodFrom), to: new Date(periodTo) },
      preparedBy: preparedBy || undefined,
    };

    generateMutation.mutate(
      { reportData, reportType: 'investor_statement', investorId: investor.id },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Generate Investor Statement
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="text-xs text-muted-foreground">Investor</Label>
            <p className="font-semibold">{investor.investor_name}</p>
          </div>

          <div>
            <Label>Reporting Period</Label>
            <Select value={periodPreset} onValueChange={handlePresetChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ytd">Year to Date</SelectItem>
                <SelectItem value="last_year">Last Calendar Year</SelectItem>
                <SelectItem value="last_quarter">Last Quarter</SelectItem>
                <SelectItem value="last_12">Last 12 Months</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">From</Label>
              <Input
                type="date"
                value={periodFrom}
                onChange={e => { setPeriodFrom(e.target.value); setPeriodPreset('custom'); }}
              />
            </div>
            <div>
              <Label className="text-xs">To</Label>
              <Input
                type="date"
                value={periodTo}
                onChange={e => { setPeriodTo(e.target.value); setPeriodPreset('custom'); }}
              />
            </div>
          </div>

          <div>
            <Label>Prepared By (optional)</Label>
            <Input
              placeholder="e.g. Finance Team"
              value={preparedBy}
              onChange={e => setPreparedBy(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleGenerate} disabled={generateMutation.isPending}>
            <Download className="h-4 w-4 mr-2" />
            {generateMutation.isPending ? 'Generating…' : 'Generate & Download'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
