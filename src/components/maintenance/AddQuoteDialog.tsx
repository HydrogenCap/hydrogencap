import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCreateQuote } from '@/hooks/useMaintenanceQuotes';
import { Plus } from 'lucide-react';

interface AddQuoteDialogProps {
  requestId: string;
  prefillContractorId?: string | null;
  prefillContractorName?: string | null;
  trigger?: React.ReactNode;
}

export function AddQuoteDialog({ requestId, prefillContractorId, prefillContractorName, trigger }: AddQuoteDialogProps) {
  const [open, setOpen] = useState(false);
  const [contractorName, setContractorName] = useState(prefillContractorName || '');
  const [amount, setAmount] = useState('');
  const [estimatedDays, setEstimatedDays] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const createQuote = useCreateQuote();

  const handleSubmit = () => {
    if (!amount) return;
    createQuote.mutate({
      maintenance_request_id: requestId,
      contractor_id: prefillContractorId || null,
      contractor_name: contractorName || null,
      amount: parseFloat(amount),
      estimated_days: estimatedDays ? parseInt(estimatedDays) : null,
      valid_until: validUntil || null,
      description: description || null,
      notes: notes || null,
    }, {
      onSuccess: () => {
        setOpen(false);
        setContractorName('');
        setAmount('');
        setEstimatedDays('');
        setValidUntil('');
        setDescription('');
        setNotes('');
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm" variant="outline">
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Quote
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Quote</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Contractor Name</Label>
            <Input value={contractorName} onChange={e => setContractorName(e.target.value)} placeholder="e.g. ABC Plumbing" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Amount (£)</Label>
              <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Estimated Days</Label>
              <Input type="number" value={estimatedDays} onChange={e => setEstimatedDays(e.target.value)} placeholder="e.g. 3" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Valid Until</Label>
            <Input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Description of Work</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe the proposed work..." rows={2} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Notes</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any additional notes" />
          </div>
          <Button onClick={handleSubmit} disabled={!amount || createQuote.isPending} className="w-full">
            {createQuote.isPending ? 'Adding...' : 'Add Quote'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
