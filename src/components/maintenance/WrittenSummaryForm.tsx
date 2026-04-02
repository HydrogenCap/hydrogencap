import { useState } from 'react';
import { FileText, Send, Download } from 'lucide-react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useSendWrittenSummary } from '@/hooks/useAwaabsLawCompliance';
import { formatCountdown, getDeadlineSeverity, DEADLINE_SEVERITY_STYLES } from '@/lib/working-days';

interface WrittenSummaryFormProps {
  requestId: string;
  /** Pre-fill from the tenant's maintenance request. */
  hazardDescription?: string;
  propertyAddress?: string;
  tenantName?: string;
  reportedDate?: string;
  investigationStartedAt?: string;
  writtenSummaryDueBy?: string;
  /** If summary was already sent. */
  existingSummary?: string | null;
  sentAt?: string | null;
}

export default function WrittenSummaryForm({
  requestId,
  hazardDescription,
  propertyAddress,
  tenantName,
  reportedDate,
  investigationStartedAt,
  writtenSummaryDueBy,
  existingSummary,
  sentAt,
}: WrittenSummaryFormProps) {
  const sendMutation = useSendWrittenSummary();

  const [findings, setFindings] = useState('');
  const [plannedRepairs, setPlannedRepairs] = useState('');
  const [expectedTimeline, setExpectedTimeline] = useState('');
  const [contractorAssigned, setContractorAssigned] = useState('');
  const [accessArrangements, setAccessArrangements] = useState('');

  const alreadySent = !!sentAt;

  const deadlineDate = writtenSummaryDueBy ? new Date(writtenSummaryDueBy) : null;
  const deadlineSeverity = deadlineDate && investigationStartedAt
    ? getDeadlineSeverity(deadlineDate, new Date(investigationStartedAt))
    : null;

  const buildSummaryText = (): string => {
    const lines: string[] = [
      `WRITTEN SUMMARY — AWAAB'S LAW COMPLIANCE`,
      ``,
      `Property: ${propertyAddress || 'N/A'}`,
      `Tenant: ${tenantName || 'N/A'}`,
      `Date of Report: ${reportedDate ? format(new Date(reportedDate), 'dd MMMM yyyy') : 'N/A'}`,
      `Investigation Started: ${investigationStartedAt ? format(new Date(investigationStartedAt), 'dd MMMM yyyy') : 'N/A'}`,
      `Summary Date: ${format(new Date(), 'dd MMMM yyyy')}`,
      ``,
      `--- HAZARD DESCRIPTION ---`,
      hazardDescription || 'As reported by tenant.',
      ``,
      `--- INVESTIGATION FINDINGS ---`,
      findings || 'To be completed.',
      ``,
      `--- PLANNED REPAIRS ---`,
      plannedRepairs || 'To be determined.',
      ``,
      `--- EXPECTED TIMELINE ---`,
      expectedTimeline || 'To be confirmed.',
      ``,
    ];

    if (contractorAssigned) {
      lines.push(`--- CONTRACTOR ---`, contractorAssigned, ``);
    }

    if (accessArrangements) {
      lines.push(`--- ACCESS ARRANGEMENTS ---`, accessArrangements, ``);
    }

    lines.push(
      `---`,
      `This summary is provided in compliance with Awaab's Law (effective 1 May 2026).`,
      `If you have any questions, please contact your landlord or managing agent.`,
    );

    return lines.join('\n');
  };

  const handleSend = () => {
    const summaryText = buildSummaryText();
    sendMutation.mutate({ requestId, summaryText });
  };

  const handleDownload = () => {
    const text = existingSummary || buildSummaryText();
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `awaabs-law-summary-${requestId.slice(0, 8)}-${format(new Date(), 'yyyy-MM-dd')}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Already sent — show the existing summary
  if (alreadySent && existingSummary) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Written Summary
            </CardTitle>
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              Sent {format(new Date(sentAt!), 'dd MMM yyyy HH:mm')}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <pre className="text-xs whitespace-pre-wrap bg-muted/50 rounded-lg p-3 border max-h-64 overflow-y-auto">
            {existingSummary}
          </pre>
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            Download PDF/Record
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Written Summary (Required)
          </CardTitle>
          {deadlineDate && deadlineSeverity && (
            <Badge variant="outline" className={DEADLINE_SEVERITY_STYLES[deadlineSeverity]}>
              Due: {formatCountdown(deadlineDate)}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Awaab's Law requires a written summary to be sent to the tenant within 3 working days of starting investigation.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Pre-filled header info */}
        <div className="grid grid-cols-2 gap-3 text-sm bg-muted/30 rounded-lg p-3">
          <div>
            <span className="text-muted-foreground">Property:</span>
            <p className="font-medium">{propertyAddress || 'N/A'}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Tenant:</span>
            <p className="font-medium">{tenantName || 'N/A'}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Reported:</span>
            <p className="font-medium">{reportedDate ? format(new Date(reportedDate), 'dd MMM yyyy') : 'N/A'}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Investigation started:</span>
            <p className="font-medium">{investigationStartedAt ? format(new Date(investigationStartedAt), 'dd MMM yyyy') : 'N/A'}</p>
          </div>
        </div>

        <Separator />

        {/* Hazard description (pre-filled from tenant report) */}
        <div className="space-y-1.5">
          <Label className="text-sm">Hazard Description</Label>
          <div className="text-sm bg-muted/30 rounded-lg p-2.5 border">
            {hazardDescription || 'No description provided.'}
          </div>
        </div>

        {/* Investigation findings */}
        <div className="space-y-1.5">
          <Label className="text-sm">Investigation Findings *</Label>
          <Textarea
            value={findings}
            onChange={(e) => setFindings(e.target.value)}
            rows={3}
            placeholder="Describe what was found during the investigation..."
          />
        </div>

        {/* Planned repairs */}
        <div className="space-y-1.5">
          <Label className="text-sm">Planned Repairs *</Label>
          <Textarea
            value={plannedRepairs}
            onChange={(e) => setPlannedRepairs(e.target.value)}
            rows={3}
            placeholder="Describe the repairs that will be carried out..."
          />
        </div>

        {/* Expected timeline */}
        <div className="space-y-1.5">
          <Label className="text-sm">Expected Timeline *</Label>
          <Input
            value={expectedTimeline}
            onChange={(e) => setExpectedTimeline(e.target.value)}
            placeholder="e.g., Repairs to begin 5 May 2026, completion expected by 12 May 2026"
          />
        </div>

        {/* Contractor */}
        <div className="space-y-1.5">
          <Label className="text-sm">Contractor Assigned (if applicable)</Label>
          <Input
            value={contractorAssigned}
            onChange={(e) => setContractorAssigned(e.target.value)}
            placeholder="e.g., ABC Plumbing Ltd"
          />
        </div>

        {/* Access arrangements */}
        <div className="space-y-1.5">
          <Label className="text-sm">Access Arrangements</Label>
          <Input
            value={accessArrangements}
            onChange={(e) => setAccessArrangements(e.target.value)}
            placeholder="e.g., Tenant to be contacted for access times"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            onClick={handleSend}
            disabled={!findings.trim() || !plannedRepairs.trim() || sendMutation.isPending}
            className="flex-1"
          >
            <Send className="h-4 w-4 mr-2" />
            {sendMutation.isPending ? 'Sending...' : 'Send to Tenant'}
          </Button>
          <Button variant="outline" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
