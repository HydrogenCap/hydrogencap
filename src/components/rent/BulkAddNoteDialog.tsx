import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useBulkAddNote, type RentScheduleWithDetails } from '@/hooks/useRentCollection';

interface BulkAddNoteDialogProps {
  items: RentScheduleWithDetails[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export default function BulkAddNoteDialog({ items, open, onOpenChange, onSuccess }: BulkAddNoteDialogProps) {
  const bulkAddNote = useBulkAddNote();
  const [note, setNote] = useState('');
  const [mode, setMode] = useState<'append' | 'replace'>('append');

  const handleConfirm = () => {
    if (!note.trim()) return;
    bulkAddNote.mutate(
      { items, note: note.trim(), mode },
      {
        onSuccess: () => {
          onOpenChange(false);
          setNote('');
          onSuccess();
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add note to {items.length} items</DialogTitle>
          <DialogDescription>
            This note will be attached to every selected rent schedule item.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Note</Label>
            <Textarea
              placeholder="e.g. Chased by phone 10/02/2026"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </div>

          <RadioGroup value={mode} onValueChange={(v) => setMode(v as 'append' | 'replace')}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="append" id="append" />
              <Label htmlFor="append">Append to existing notes</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="replace" id="replace" />
              <Label htmlFor="replace">Replace existing notes</Label>
            </div>
          </RadioGroup>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={!note.trim() || bulkAddNote.isPending}>
            {bulkAddNote.isPending ? 'Saving…' : 'Save note'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
