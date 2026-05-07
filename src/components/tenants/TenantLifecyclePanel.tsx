import { useState } from 'react';
import { format } from 'date-fns';
import {
  UserPlus, ClipboardCheck, Home, Bell, DoorOpen,
  Plus, ChevronRight, FileText, AlertTriangle, CheckCircle,
  Clock, MessageSquare, Wrench, PoundSterling,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  useTenantLifecycleEvents,
  useLogLifecycleEvent,
} from '@/hooks/useTenantLifecycle';
import type { TenantStatusV2 } from '@/hooks/useTenantsV2';
import type { LifecycleEventType, TenantLifecycleEvent } from '@/hooks/useTenantLifecycle';

// ============================================================
// Stage Indicator
// ============================================================

const LIFECYCLE_STAGES = [
  { key: 'prospective', label: 'Prospective', icon: UserPlus },
  { key: 'referenced', label: 'Referenced', icon: ClipboardCheck },
  { key: 'active', label: 'Active', icon: Home },
  { key: 'in_notice', label: 'In Notice', icon: Bell },
  { key: 'departed', label: 'Departed', icon: DoorOpen },
] as const;

type LifecycleStage = (typeof LIFECYCLE_STAGES)[number]['key'];

function mapStatusToStage(status: TenantStatusV2): LifecycleStage {
  switch (status) {
    case 'prospective': return 'prospective';
    case 'active': return 'active';
    case 'in_notice': return 'in_notice';
    case 'departed':
    case 'evicted':
    case 'archived':
      return 'departed';
    default: return 'prospective';
  }
}

function StageIndicator({ currentStatus }: { currentStatus: TenantStatusV2 }) {
  const currentStage = mapStatusToStage(currentStatus);
  const currentIdx = LIFECYCLE_STAGES.findIndex(s => s.key === currentStage);

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-2">
      {LIFECYCLE_STAGES.map((stage, idx) => {
        const Icon = stage.icon;
        const isActive = idx === currentIdx;
        const isPast = idx < currentIdx;
        return (
          <div key={stage.key} className="flex items-center">
            <div
              className={cn(
                'flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                isActive && 'bg-primary text-primary-foreground',
                isPast && 'bg-primary/10 text-primary',
                !isActive && !isPast && 'bg-muted text-muted-foreground',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {stage.label}
            </div>
            {idx < LIFECYCLE_STAGES.length - 1 && (
              <ChevronRight className={cn('h-4 w-4 mx-0.5 flex-shrink-0', isPast ? 'text-primary/40' : 'text-muted-foreground/60')} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// Transition Buttons
// ============================================================

const TRANSITIONS: Record<string, { label: string; to: TenantStatusV2; variant: 'default' | 'outline' | 'destructive' }[]> = {
  prospective: [
    { label: 'Mark as Referenced', to: 'active', variant: 'default' },
  ],
  active: [
    { label: 'Serve Notice', to: 'in_notice', variant: 'outline' },
  ],
  in_notice: [
    { label: 'Mark Departed', to: 'departed', variant: 'destructive' },
    { label: 'Cancel Notice', to: 'active', variant: 'outline' },
  ],
  departed: [],
};

// ============================================================
// Event Icon Mapping
// ============================================================

const EVENT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  application_received: UserPlus,
  reference_requested: ClipboardCheck,
  reference_completed: CheckCircle,
  agreement_signed: FileText,
  moved_in: Home,
  rent_increase: PoundSterling,
  notice_served: Bell,
  notice_received: Bell,
  inspection_scheduled: Clock,
  inspection_completed: Wrench,
  complaint_received: AlertTriangle,
  complaint_resolved: CheckCircle,
  arrears_flagged: AlertTriangle,
  arrears_cleared: CheckCircle,
  moved_out: DoorOpen,
  deposit_returned: PoundSterling,
  status_change: ClipboardCheck,
  note: MessageSquare,
  custom: FileText,
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  application_received: 'Application Received',
  reference_requested: 'Reference Requested',
  reference_completed: 'Reference Completed',
  agreement_signed: 'Agreement Signed',
  moved_in: 'Moved In',
  rent_increase: 'Rent Increase',
  notice_served: 'Notice Served',
  notice_received: 'Notice Received',
  inspection_scheduled: 'Inspection Scheduled',
  inspection_completed: 'Inspection Completed',
  complaint_received: 'Complaint Received',
  complaint_resolved: 'Complaint Resolved',
  arrears_flagged: 'Arrears Flagged',
  arrears_cleared: 'Arrears Cleared',
  moved_out: 'Moved Out',
  deposit_returned: 'Deposit Returned',
  status_change: 'Status Change',
  note: 'Note',
  custom: 'Custom Event',
};

// ============================================================
// Timeline Item
// ============================================================

function TimelineItem({ event }: { event: TenantLifecycleEvent }) {
  const Icon = EVENT_ICONS[event.event_type] || FileText;
  return (
    <div className="flex gap-3 relative">
      <div className="flex flex-col items-center">
        <div className="rounded-full p-1.5 bg-muted border">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <div className="flex-1 w-px bg-border" />
      </div>
      <div className="pb-6 flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-medium">{EVENT_TYPE_LABELS[event.event_type] || event.event_type}</span>
          <span className="text-xs text-muted-foreground">
            {format(new Date(event.created_at), 'dd MMM yyyy HH:mm')}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">{event.description}</p>
      </div>
    </div>
  );
}

// ============================================================
// Add Event Form
// ============================================================

function AddEventForm({ tenantId, tenancyId, onDone }: { tenantId: string; tenancyId?: string | null; onDone: () => void }) {
  const [eventType, setEventType] = useState<LifecycleEventType>('note');
  const [description, setDescription] = useState('');
  const logEvent = useLogLifecycleEvent();

  const handleSubmit = () => {
    if (!description.trim()) return;
    logEvent.mutate(
      {
        tenant_id: tenantId,
        tenancy_id: tenancyId ?? null,
        event_type: eventType,
        description: description.trim(),
        metadata: {},
      },
      { onSuccess: () => { setDescription(''); onDone(); } },
    );
  };

  return (
    <div className="space-y-3 p-3 bg-muted rounded-lg">
      <Select value={eventType} onValueChange={(v) => setEventType(v as LifecycleEventType)}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(EVENT_TYPE_LABELS).map(([k, v]) => (
            <SelectItem key={k} value={k}>{v}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Textarea
        placeholder="Describe what happened..."
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
      />
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="ghost" onClick={onDone}>Cancel</Button>
        <Button size="sm" onClick={handleSubmit} disabled={!description.trim() || logEvent.isPending}>
          {logEvent.isPending ? 'Saving...' : 'Add Event'}
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// Main Panel
// ============================================================

interface TenantLifecyclePanelProps {
  tenantId: string;
  tenantStatus: TenantStatusV2;
  tenancyId?: string | null;
  onStatusTransition?: (newStatus: TenantStatusV2) => void;
}

export function TenantLifecyclePanel({
  tenantId,
  tenantStatus,
  tenancyId,
  onStatusTransition,
}: TenantLifecyclePanelProps) {
  const { data: events, isLoading } = useTenantLifecycleEvents(tenantId);
  const [showAddEvent, setShowAddEvent] = useState(false);

  const transitions = TRANSITIONS[tenantStatus] ?? [];

  return (
    <div className="space-y-4">
      {/* Stage Indicator */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Lifecycle Stage</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <StageIndicator currentStatus={tenantStatus} />
          {transitions.length > 0 && onStatusTransition && (
            <div className="flex gap-2 flex-wrap">
              {transitions.map((t) => (
                <Button
                  key={t.to}
                  size="sm"
                  variant={t.variant}
                  onClick={() => onStatusTransition(t.to)}
                >
                  {t.label}
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Lifecycle Timeline</CardTitle>
            <Button size="sm" variant="outline" onClick={() => setShowAddEvent(!showAddEvent)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Event
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {showAddEvent && (
            <div className="mb-4">
              <AddEventForm
                tenantId={tenantId}
                tenancyId={tenancyId}
                onDone={() => setShowAddEvent(false)}
              />
            </div>
          )}

          {isLoading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Loading...</p>
          ) : !events || events.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No lifecycle events recorded yet.
            </p>
          ) : (
            <div className="mt-2">
              {events.map((event) => (
                <TimelineItem key={event.id} event={event} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
