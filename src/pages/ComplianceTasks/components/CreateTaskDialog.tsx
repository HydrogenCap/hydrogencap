import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TASK_TYPE_NAMES, PRIORITY_NAMES } from '@/lib/complianceTaskTypes';

interface Props {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  isPending: boolean;
}

export function CreateTaskDialog({ open, onOpenChange, onSubmit, isPending }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Create Compliance Task</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div><Label>Title *</Label><Input name="title" required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Property ID *</Label><Input name="property_id" required placeholder="UUID" /></div>
            <div><Label>Document Type *</Label><Input name="document_type" required placeholder="e.g. gas_safety_certificate" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Task Type *</Label>
              <Select name="task_type" defaultValue="renewal_due">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TASK_TYPE_NAMES).map(([k, v]) => <SelectItem key={k} value={k}>{v as string}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Priority</Label>
              <Select name="priority" defaultValue="medium">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_NAMES).map(([k, v]) => <SelectItem key={k} value={k}>{v as string}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Assigned To</Label><Input name="assigned_to" /></div>
            <div><Label>Due Date</Label><Input name="due_date" type="date" /></div>
          </div>
          <div><Label>Notes</Label><Textarea name="notes" /></div>
          <DialogFooter>
            <Button type="submit" disabled={isPending}>Create</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
