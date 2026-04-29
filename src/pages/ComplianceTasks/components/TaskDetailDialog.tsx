import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, formatDistanceToNow } from 'date-fns';
import { CheckCircle2, CalendarPlus, Ban } from 'lucide-react';
import { DOC_TYPE_DISPLAY_NAMES } from '@/lib/complianceV2Types';
import {
  PIPELINE_COLUMNS, TASK_STATUS_NAMES,
  type ComplianceTaskOverview, type TaskStatus,
} from '@/lib/complianceTaskTypes';
import { PriorityBadge, EscalationDots } from '../utils/badges';

interface Props {
  selectedTask: ComplianceTaskOverview | null;
  dismissReason: string;
  setDismissReason: (s: string) => void;
  onClose: () => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onSnooze: (id: string, days: number) => void;
  onDismiss: (id: string) => void;
}

export function TaskDetailDialog({
  selectedTask, dismissReason, setDismissReason,
  onClose, onStatusChange, onSnooze, onDismiss,
}: Props) {
  return (
    <Dialog open={!!selectedTask} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        {selectedTask && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedTask.title}
                <PriorityBadge priority={selectedTask.priority} />
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-muted-foreground">Property</Label><p>{selectedTask.property_address}</p></div>
                <div><Label className="text-muted-foreground">Document</Label><p>{DOC_TYPE_DISPLAY_NAMES[selectedTask.document_type as keyof typeof DOC_TYPE_DISPLAY_NAMES] || selectedTask.document_type}</p></div>
                <div><Label className="text-muted-foreground">Status</Label><p>{TASK_STATUS_NAMES[selectedTask.status] || selectedTask.status}</p></div>
                <div><Label className="text-muted-foreground">Due Date</Label><p>{selectedTask.due_date ? format(new Date(selectedTask.due_date), 'dd MMM yyyy') : '—'}</p></div>
                <div><Label className="text-muted-foreground">Source</Label><p>{selectedTask.source === 'auto_pipeline' ? 'Auto Pipeline' : selectedTask.source === 'auto' ? 'Auto-generated' : 'Manual'}</p></div>
                <div><Label className="text-muted-foreground">Escalation</Label><div className="flex items-center gap-2"><span>{selectedTask.escalation_level}</span><EscalationDots level={selectedTask.escalation_level} /></div></div>
                {selectedTask.contractor_name && <div><Label className="text-muted-foreground">Contractor</Label><p className="text-primary">{selectedTask.contractor_name}</p></div>}
                {selectedTask.quoted_cost != null && <div><Label className="text-muted-foreground">Quoted</Label><p>£{selectedTask.quoted_cost}</p></div>}
                {selectedTask.actual_cost != null && <div><Label className="text-muted-foreground">Actual</Label><p>£{selectedTask.actual_cost}</p></div>}
              </div>
              {selectedTask.notes && <div><Label className="text-muted-foreground">Notes</Label><p className="whitespace-pre-wrap">{selectedTask.notes}</p></div>}
              {selectedTask.resolution_notes && <div><Label className="text-muted-foreground">Resolution</Label><p className="whitespace-pre-wrap">{selectedTask.resolution_notes}</p></div>}
              <p className="text-xs text-muted-foreground">Created {formatDistanceToNow(new Date(selectedTask.created_at))} ago</p>

              {/* Pipeline Actions */}
              {!['completed', 'cancelled'].includes(selectedTask.status) && (
                <div className="space-y-3 pt-2 border-t">
                  <h4 className="text-sm font-semibold">Actions</h4>

                  {/* Change Status */}
                  <div className="flex items-center gap-2">
                    <Label className="text-xs w-20">Status</Label>
                    <Select value={selectedTask.status} onValueChange={(v) => {
                      onStatusChange(selectedTask.task_id, v as TaskStatus);
                      onClose();
                    }}>
                      <SelectTrigger className="h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[...PIPELINE_COLUMNS, 'cancelled' as TaskStatus].map(s => (
                          <SelectItem key={s} value={s}>{TASK_STATUS_NAMES[s] || s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Mark Complete */}
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      onStatusChange(selectedTask.task_id, 'completed');
                      onClose();
                    }}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Mark Complete
                  </Button>

                  {/* Snooze */}
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => onSnooze(selectedTask.task_id, 7)}>
                      <CalendarPlus className="h-3 w-3 mr-1" />+7d
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => onSnooze(selectedTask.task_id, 14)}>
                      +14d
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => onSnooze(selectedTask.task_id, 30)}>
                      +30d
                    </Button>
                  </div>

                  {/* Dismiss */}
                  <div className="space-y-2">
                    <Input
                      placeholder="Dismiss reason (required)..."
                      value={dismissReason}
                      onChange={(e) => setDismissReason(e.target.value)}
                      className="text-xs"
                    />
                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full"
                      onClick={() => onDismiss(selectedTask.task_id)}
                      disabled={!dismissReason.trim()}
                    >
                      <Ban className="h-4 w-4 mr-1" />
                      Dismiss Task
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
