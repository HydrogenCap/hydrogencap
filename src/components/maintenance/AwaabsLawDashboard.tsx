import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import {
  Shield, AlertTriangle, Clock, CheckCircle2, Siren, TrendingUp,
  ChevronDown, ChevronUp, Search, FileText, Play, Wrench,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { LoadingState, EmptyState } from '@/components/common';
import {
  useActiveHazards,
  useBreachRisk,
  useComplianceStats,
  useStartInvestigation,
  useStartRepair,
  useCompleteRepair,
  useHazardDeadlines,
  getTrackingStatus,
  AWAABS_STATUS_CONFIG,
  type AwaabsLawFields,
  type HazardCategory,
  type AwaabsTrackingStatus,
} from '@/hooks/useAwaabsLawCompliance';
import {
  formatCountdown,
  getDeadlineSeverity,
  DEADLINE_SEVERITY_STYLES,
  type DeadlineSeverity,
} from '@/lib/working-days';
import HazardClassifier from './HazardClassifier';
import WrittenSummaryForm from './WrittenSummaryForm';

// ── Hazard category badges ──────────────────────────────────────────────

const HAZARD_BADGE_STYLES: Record<string, string> = {
  emergency: 'bg-red-100 text-red-800 border-red-200',
  significant: 'bg-amber-100 text-amber-800 border-amber-200',
  standard: 'bg-blue-100 text-blue-800 border-blue-200',
  not_hazard: 'bg-gray-100 text-gray-600 border-gray-200',
};

// ── Helper to get property address from a request ───────────────────────

function getPropertyAddress(request: any): string {
  if (request.property_v2?.address_line_1) {
    return `${request.property_v2.address_line_1}, ${request.property_v2.postcode || ''}`.trim();
  }
  if (request.property?.address_line) {
    return `${request.property.address_line}, ${request.property.postcode || ''}`.trim();
  }
  return 'Unknown property';
}

function getTenantName(request: any): string {
  const t = request.tenant_v2 || request.tenant;
  if (t) return `${t.first_name} ${t.last_name}`;
  return 'Unknown tenant';
}

// ── Deadline Cell ───────────────────────────────────────────────────────

function DeadlineCell({ deadline, startDate }: { deadline: string | null; startDate: string | null }) {
  if (!deadline) return <span className="text-muted-foreground text-xs">—</span>;

  const deadlineDate = new Date(deadline);
  const start = startDate ? new Date(startDate) : new Date();
  const severity = getDeadlineSeverity(deadlineDate, start);
  const styles = DEADLINE_SEVERITY_STYLES[severity];

  return (
    <Badge variant="outline" className={`text-xs font-mono ${styles}`}>
      {formatCountdown(deadlineDate)}
    </Badge>
  );
}

// ── Hazard row with actions ─────────────────────────────────────────────

function HazardRow({ request, onOpenDetail }: { request: any; onOpenDetail: (r: any) => void }) {
  const fields: AwaabsLawFields = {
    hazard_category: request.hazard_category,
    awaabs_law_applies: request.awaabs_law_applies ?? true,
    reported_at: request.reported_at,
    investigation_started_at: request.investigation_started_at,
    investigation_due_by: request.investigation_due_by,
    written_summary_sent_at: request.written_summary_sent_at,
    written_summary_due_by: request.written_summary_due_by,
    repair_started_at: request.repair_started_at,
    repair_due_by: request.repair_due_by,
    repair_completed_at: request.repair_completed_at,
    written_summary_text: request.written_summary_text,
    escalation_level: request.escalation_level || 'normal',
    breach_notified: request.breach_notified || false,
  };

  const trackingStatus = getTrackingStatus(fields);
  const statusConfig = AWAABS_STATUS_CONFIG[trackingStatus];
  const hazardStyle = HAZARD_BADGE_STYLES[request.hazard_category || 'standard'];

  return (
    <TableRow
      className="cursor-pointer hover:bg-accent/50"
      onClick={() => onOpenDetail(request)}
    >
      <TableCell className="max-w-[180px]">
        <div className="truncate font-medium text-sm">{getPropertyAddress(request)}</div>
        <div className="text-xs text-muted-foreground truncate">{request.title}</div>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={`text-xs ${hazardStyle}`}>
          {(request.hazard_category || 'unclassified').replace('_', ' ')}
        </Badge>
      </TableCell>
      <TableCell>
        {request.reported_at
          ? format(new Date(request.reported_at), 'dd MMM yyyy')
          : format(new Date(request.created_at), 'dd MMM yyyy')}
      </TableCell>
      <TableCell>
        <DeadlineCell deadline={request.investigation_due_by} startDate={request.reported_at} />
      </TableCell>
      <TableCell>
        <DeadlineCell deadline={request.written_summary_due_by} startDate={request.investigation_started_at} />
      </TableCell>
      <TableCell>
        <DeadlineCell deadline={request.repair_due_by} startDate={request.reported_at} />
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={`text-xs ${statusConfig.color}`}>
          {statusConfig.label}
        </Badge>
      </TableCell>
    </TableRow>
  );
}

// ── Detail dialog ───────────────────────────────────────────────────────

function HazardDetailDialog({
  request,
  open,
  onOpenChange,
}: {
  request: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const startInvestigation = useStartInvestigation();
  const startRepair = useStartRepair();
  const completeRepair = useCompleteRepair();

  if (!request) return null;

  const fields: AwaabsLawFields = {
    hazard_category: request.hazard_category,
    awaabs_law_applies: request.awaabs_law_applies ?? true,
    reported_at: request.reported_at,
    investigation_started_at: request.investigation_started_at,
    investigation_due_by: request.investigation_due_by,
    written_summary_sent_at: request.written_summary_sent_at,
    written_summary_due_by: request.written_summary_due_by,
    repair_started_at: request.repair_started_at,
    repair_due_by: request.repair_due_by,
    repair_completed_at: request.repair_completed_at,
    written_summary_text: request.written_summary_text,
    escalation_level: request.escalation_level || 'normal',
    breach_notified: request.breach_notified || false,
  };

  const status = getTrackingStatus(fields);
  const propertyAddress = getPropertyAddress(request);
  const tenantName = getTenantName(request);

  const showClassifier = !request.hazard_category;
  const showWrittenSummary = request.investigation_started_at && !request.repair_started_at;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Awaab's Law Tracking
          </DialogTitle>
          <DialogDescription>
            {propertyAddress} — {request.title}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Progress timeline */}
          <div className="flex items-center gap-1 text-xs">
            <StepIndicator
              label="Reported"
              done={!!request.reported_at}
              active={status === 'awaiting_investigation'}
            />
            <div className="flex-1 h-px bg-border" />
            <StepIndicator
              label="Investigated"
              done={!!request.investigation_started_at}
              active={status === 'investigating'}
            />
            <div className="flex-1 h-px bg-border" />
            <StepIndicator
              label="Summary Sent"
              done={!!request.written_summary_sent_at}
              active={status === 'summary_due'}
            />
            <div className="flex-1 h-px bg-border" />
            <StepIndicator
              label="Repair Started"
              done={!!request.repair_started_at}
              active={status === 'awaiting_repair'}
            />
            <div className="flex-1 h-px bg-border" />
            <StepIndicator
              label="Completed"
              done={!!request.repair_completed_at}
              active={status === 'repair_in_progress'}
            />
          </div>

          <Separator />

          {/* Hazard classifier (if not yet classified) */}
          {showClassifier && (
            <HazardClassifier
              requestId={request.id}
              category={request.category}
              description={request.description || ''}
              urgency={request.priority}
              currentClassification={request.hazard_category}
              reportedAt={request.reported_at || request.created_at}
            />
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            {!request.investigation_started_at && request.hazard_category && (
              <Button
                size="sm"
                onClick={() => startInvestigation.mutate(request.id)}
                disabled={startInvestigation.isPending}
              >
                <Search className="h-4 w-4 mr-1" />
                {startInvestigation.isPending ? 'Starting...' : 'Start Investigation'}
              </Button>
            )}
            {request.written_summary_sent_at && !request.repair_started_at && (
              <Button
                size="sm"
                onClick={() => startRepair.mutate(request.id)}
                disabled={startRepair.isPending}
              >
                <Wrench className="h-4 w-4 mr-1" />
                {startRepair.isPending ? 'Starting...' : 'Start Repair'}
              </Button>
            )}
            {request.repair_started_at && !request.repair_completed_at && (
              <Button
                size="sm"
                variant="default"
                onClick={() => completeRepair.mutate(request.id)}
                disabled={completeRepair.isPending}
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                {completeRepair.isPending ? 'Completing...' : 'Complete Repair'}
              </Button>
            )}
          </div>

          {/* Written summary form */}
          {showWrittenSummary && (
            <WrittenSummaryForm
              requestId={request.id}
              hazardDescription={request.description}
              propertyAddress={propertyAddress}
              tenantName={tenantName}
              reportedDate={request.reported_at || request.created_at}
              investigationStartedAt={request.investigation_started_at}
              writtenSummaryDueBy={request.written_summary_due_by}
              existingSummary={request.written_summary_text}
              sentAt={request.written_summary_sent_at}
            />
          )}

          {/* Show existing summary if already sent and past that step */}
          {request.written_summary_sent_at && request.repair_started_at && request.written_summary_text && (
            <WrittenSummaryForm
              requestId={request.id}
              existingSummary={request.written_summary_text}
              sentAt={request.written_summary_sent_at}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StepIndicator({ label, done, active }: { label: string; done: boolean; active: boolean }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div
        className={`h-3 w-3 rounded-full border-2 ${
          done
            ? 'bg-green-500 border-green-500'
            : active
              ? 'bg-primary border-primary animate-pulse'
              : 'bg-background border-muted-foreground/30'
        }`}
      />
      <span className={`text-[10px] ${done ? 'text-green-700 font-medium' : active ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
        {label}
      </span>
    </div>
  );
}

// ── Main dashboard ──────────────────────────────────────────────────────

export default function AwaabsLawDashboard() {
  const { data: hazards, isLoading } = useActiveHazards();
  const breachRisk = useBreachRisk();
  const { data: complianceStats } = useComplianceStats();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const filteredHazards = useMemo(() => {
    if (!hazards) return [];
    if (!searchQuery) return hazards;
    const q = searchQuery.toLowerCase();
    return hazards.filter((h: any) => {
      const addr = getPropertyAddress(h).toLowerCase();
      const title = (h.title || '').toLowerCase();
      const cat = (h.hazard_category || '').toLowerCase();
      return addr.includes(q) || title.includes(q) || cat.includes(q);
    });
  }, [hazards, searchQuery]);

  const openDetail = (request: any) => {
    setSelectedRequest(request);
    setDetailOpen(true);
  };

  if (isLoading) return <LoadingState text="Loading Awaab's Law compliance data..." />;

  return (
    <div className="space-y-6">
      {/* Breach risk panel */}
      {(breachRisk.overdue > 0 || breachRisk.next24h > 0 || breachRisk.next48h > 0) && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Siren className="h-5 w-5 text-red-600 animate-pulse" />
            <h3 className="font-semibold text-red-800">Breach Risk Alert</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {breachRisk.overdue > 0 && (
              <div className="bg-black text-white rounded-lg p-3 text-center animate-pulse">
                <p className="text-2xl font-bold">{breachRisk.overdue}</p>
                <p className="text-xs opacity-80">OVERDUE</p>
              </div>
            )}
            {breachRisk.next24h > 0 && (
              <div className="bg-red-100 border border-red-300 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-red-800">{breachRisk.next24h}</p>
                <p className="text-xs text-red-600">Due in 24hrs</p>
              </div>
            )}
            {breachRisk.next48h > 0 && (
              <div className="bg-amber-100 border border-amber-300 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-amber-800">{breachRisk.next48h}</p>
                <p className="text-xs text-amber-600">Due in 48hrs</p>
              </div>
            )}
            {breachRisk.next5days > 0 && (
              <div className="bg-blue-100 border border-blue-300 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-blue-800">{breachRisk.next5days}</p>
                <p className="text-xs text-blue-600">Due in 5 days</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Compliance stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Hazards</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{hazards?.length || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{complianceStats?.totalHazardsThisMonth || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Response</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {complianceStats?.avgResponseTimeHours != null ? `${complianceStats.avgResponseTimeHours}h` : '—'}
            </p>
          </CardContent>
        </Card>
        <Card className={complianceStats && complianceStats.complianceRate < 100 ? 'border-red-200' : 'border-green-200'}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Compliance Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${
              complianceStats && complianceStats.complianceRate < 90
                ? 'text-red-600'
                : complianceStats && complianceStats.complianceRate < 100
                  ? 'text-amber-600'
                  : 'text-green-600'
            }`}>
              {complianceStats?.complianceRate ?? 100}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by property, description, or category..."
            className="pl-9"
          />
        </div>
        <Badge variant="outline" className="shrink-0">
          {filteredHazards.length} hazard{filteredHazards.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {/* Active hazards table */}
      {filteredHazards.length === 0 ? (
        <EmptyState
          icon={Shield}
          title="No active hazards"
          description="All maintenance requests are either resolved or not flagged under Awaab's Law."
        />
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Property / Issue</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Reported</TableHead>
                <TableHead>Investigation</TableHead>
                <TableHead>Summary</TableHead>
                <TableHead>Repair</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredHazards.map((request: any) => (
                <HazardRow
                  key={request.id}
                  request={request}
                  onOpenDetail={openDetail}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Detail dialog */}
      <HazardDetailDialog
        request={selectedRequest}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
}
