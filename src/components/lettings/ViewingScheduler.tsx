import { useState } from 'react';
import { format, parseISO, isAfter, isBefore, startOfDay } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar, Plus, Clock, User, Phone, Mail, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useViewings,
  useCreateViewing,
  useUpdateViewing,
  type PropertyViewing,
} from '@/hooks/useLettingsWorkflow';
import type { LettingsPipelineItem } from '@/hooks/useLettingsPipeline';

const STATUS_STYLES: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  scheduled: { label: 'Scheduled', variant: 'outline' },
  attended: { label: 'Attended', variant: 'default' },
  no_show: { label: 'No Show', variant: 'destructive' },
  cancelled: { label: 'Cancelled', variant: 'secondary' },
};

interface ViewingSchedulerProps {
  item: LettingsPipelineItem;
}

export function ViewingScheduler({ item }: ViewingSchedulerProps) {
  const { data: viewings = [], isLoading } = useViewings(item.id);
  const createViewing = useCreateViewing();
  const updateViewing = useUpdateViewing();
  const [showAdd, setShowAdd] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [newViewing, setNewViewing] = useState({
    applicant_name: '',
    applicant_email: '',
    applicant_phone: '',
    viewing_date: '',
    viewing_time: '',
  });

  const handleCreate = () => {
    if (!newViewing.applicant_name || !newViewing.viewing_date || !newViewing.viewing_time) return;
    createViewing.mutate({
      property_id: item.property_id,
      letting_id: item.id,
      applicant_name: newViewing.applicant_name,
      applicant_email: newViewing.applicant_email || null,
      applicant_phone: newViewing.applicant_phone || null,
      viewing_date: newViewing.viewing_date,
      viewing_time: newViewing.viewing_time,
      status: 'scheduled',
      feedback: null,
    }, {
      onSuccess: () => {
        setNewViewing({ applicant_name: '', applicant_email: '', applicant_phone: '', viewing_date: '', viewing_time: '' });
        setShowAdd(false);
      },
    });
  };

  const updateStatus = (viewing: PropertyViewing, status: PropertyViewing['status']) => {
    updateViewing.mutate({ id: viewing.id, lettingId: item.id, status });
  };

  const updateFeedback = (viewing: PropertyViewing, feedback: string) => {
    updateViewing.mutate({ id: viewing.id, lettingId: item.id, feedback: feedback || null });
  };

  const today = startOfDay(new Date());
  const upcoming = viewings.filter(v => v.status === 'scheduled' && !isBefore(parseISO(v.viewing_date), today));
  const past = viewings.filter(v => v.status !== 'scheduled' || isBefore(parseISO(v.viewing_date), today));

  const stats = {
    total: viewings.length,
    attended: viewings.filter(v => v.status === 'attended').length,
    noShow: viewings.filter(v => v.status === 'no_show').length,
    scheduled: upcoming.length,
  };

  if (isLoading) return <p className="text-sm text-muted-foreground py-4">Loading viewings…</p>;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Total', value: stats.total },
          { label: 'Scheduled', value: stats.scheduled },
          { label: 'Attended', value: stats.attended },
          { label: 'No Shows', value: stats.noShow },
        ].map(s => (
          <div key={s.label} className="text-center p-2 rounded-lg bg-muted/50">
            <p className="text-lg font-semibold">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Add viewing */}
      {!showAdd ? (
        <Button variant="outline" className="w-full" onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4 mr-1" /> Schedule Viewing
        </Button>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">New Viewing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Applicant Name *</Label>
                <Input
                  value={newViewing.applicant_name}
                  onChange={e => setNewViewing(p => ({ ...p, applicant_name: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs">Email</Label>
                <Input
                  type="email"
                  value={newViewing.applicant_email}
                  onChange={e => setNewViewing(p => ({ ...p, applicant_email: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs">Phone</Label>
                <Input
                  value={newViewing.applicant_phone}
                  onChange={e => setNewViewing(p => ({ ...p, applicant_phone: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs">Date *</Label>
                <Input
                  type="date"
                  value={newViewing.viewing_date}
                  onChange={e => setNewViewing(p => ({ ...p, viewing_date: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs">Time *</Label>
                <Input
                  type="time"
                  value={newViewing.viewing_time}
                  onChange={e => setNewViewing(p => ({ ...p, viewing_time: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleCreate}
                disabled={createViewing.isPending || !newViewing.applicant_name || !newViewing.viewing_date || !newViewing.viewing_time}
              >
                Schedule
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
            <Calendar className="h-4 w-4" /> Upcoming ({upcoming.length})
          </h4>
          <div className="space-y-2">
            {upcoming.map(v => (
              <ViewingCard
                key={v.id}
                viewing={v}
                lettingId={item.id}
                expanded={expandedId === v.id}
                onToggle={() => setExpandedId(expandedId === v.id ? null : v.id)}
                onStatusChange={s => updateStatus(v, s)}
                onFeedbackChange={f => updateFeedback(v, f)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Past */}
      {past.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2 text-muted-foreground">Past Viewings ({past.length})</h4>
          <div className="space-y-2">
            {past.map(v => (
              <ViewingCard
                key={v.id}
                viewing={v}
                lettingId={item.id}
                expanded={expandedId === v.id}
                onToggle={() => setExpandedId(expandedId === v.id ? null : v.id)}
                onStatusChange={s => updateStatus(v, s)}
                onFeedbackChange={f => updateFeedback(v, f)}
              />
            ))}
          </div>
        </div>
      )}

      {viewings.length === 0 && !showAdd && (
        <p className="text-sm text-muted-foreground text-center py-4">No viewings scheduled yet.</p>
      )}
    </div>
  );
}

function ViewingCard({
  viewing,
  lettingId,
  expanded,
  onToggle,
  onStatusChange,
  onFeedbackChange,
}: {
  viewing: PropertyViewing;
  lettingId: string;
  expanded: boolean;
  onToggle: () => void;
  onStatusChange: (status: PropertyViewing['status']) => void;
  onFeedbackChange: (feedback: string) => void;
}) {
  const style = STATUS_STYLES[viewing.status] || STATUS_STYLES.scheduled;

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left p-3 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-center min-w-[44px]">
              <p className="text-xs text-muted-foreground">{format(parseISO(viewing.viewing_date), 'EEE')}</p>
              <p className="font-semibold text-sm">{format(parseISO(viewing.viewing_date), 'dd MMM')}</p>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span className="text-sm">{viewing.viewing_time.slice(0, 5)}</span>
              </div>
              <div className="flex items-center gap-2">
                <User className="h-3 w-3 text-muted-foreground" />
                <span className="text-sm font-medium">{viewing.applicant_name}</span>
              </div>
            </div>
          </div>
          <Badge variant={style.variant}>{style.label}</Badge>
        </div>
      </button>

      {expanded && (
        <CardContent className="border-t pt-3 space-y-3">
          <div className="text-sm space-y-1">
            {viewing.applicant_email && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-3 w-3" /> {viewing.applicant_email}
              </div>
            )}
            {viewing.applicant_phone && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-3 w-3" /> {viewing.applicant_phone}
              </div>
            )}
          </div>

          <div>
            <Label className="text-xs">Status</Label>
            <Select value={viewing.status} onValueChange={(v) => onStatusChange(v as PropertyViewing['status'])}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="attended">Attended</SelectItem>
                <SelectItem value="no_show">No Show</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs flex items-center gap-1">
              <MessageSquare className="h-3 w-3" /> Feedback
            </Label>
            <Textarea
              className="text-xs"
              rows={2}
              defaultValue={viewing.feedback ?? ''}
              placeholder="Notes from viewing…"
              onBlur={e => {
                if (e.target.value !== (viewing.feedback ?? '')) onFeedbackChange(e.target.value);
              }}
            />
          </div>
        </CardContent>
      )}
    </Card>
  );
}
