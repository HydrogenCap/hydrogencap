import React, { useState, useEffect } from 'react';
import { Plus, User, Building2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
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
import { useParties, useCreateParty, type PartyType } from '@/hooks/useParties';
import {
  useAddShareholding,
  useUpdateShareholding,
  type ShareClass,
  type Shareholding,
} from '@/hooks/useCompanies';
import { useToast } from '@/hooks/use-toast';

interface ShareholdingEditorProps {
  companyId: string;
  shareClasses: ShareClass[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingShareholding?: Shareholding | null;
  preselectedShareClassId?: string | null;
}

const PARTY_TYPES: { value: PartyType; label: string; icon: React.ReactNode }[] = [
  { value: 'INDIVIDUAL', label: 'Individual', icon: <User className="h-4 w-4" /> },
  { value: 'COMPANY', label: 'Company', icon: <Building2 className="h-4 w-4" /> },
  { value: 'TRUST', label: 'Trust', icon: <Building2 className="h-4 w-4" /> },
];

export function ShareholdingEditor({
  companyId,
  shareClasses,
  open,
  onOpenChange,
  editingShareholding,
  preselectedShareClassId,
}: ShareholdingEditorProps) {
  const { toast } = useToast();
  const { data: parties } = useParties();
  const createParty = useCreateParty();
  const addShareholding = useAddShareholding();
  const updateShareholding = useUpdateShareholding();

  const [selectedPartyId, setSelectedPartyId] = useState<string>('');
  const [selectedShareClassId, setSelectedShareClassId] = useState<string>('');
  const [sharesHeld, setSharesHeld] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [showNewPartyForm, setShowNewPartyForm] = useState(false);
  const [newPartyName, setNewPartyName] = useState('');
  const [newPartyType, setNewPartyType] = useState<PartyType>('INDIVIDUAL');

  const isEditing = !!editingShareholding;
  const isSubmitting = addShareholding.isPending || updateShareholding.isPending;

  useEffect(() => {
    if (open) {
      if (editingShareholding) {
        setSelectedPartyId(editingShareholding.shareholder_party_id);
        setSelectedShareClassId(editingShareholding.share_class_id);
        setSharesHeld(String(editingShareholding.shares_held));
        setNotes(editingShareholding.notes || '');
      } else {
        setSelectedPartyId('');
        // Use preselected share class if provided, otherwise default to first
        setSelectedShareClassId(preselectedShareClassId || shareClasses[0]?.id || '');
        setSharesHeld('');
        setNotes('');
      }
      setShowNewPartyForm(false);
      setNewPartyName('');
      setNewPartyType('INDIVIDUAL');
    }
  }, [open, editingShareholding, shareClasses, preselectedShareClassId]);

  const handleCreateParty = async () => {
    if (!newPartyName.trim()) {
      toast({ title: 'Missing name', description: 'Add a name before saving.', variant: 'destructive' });
      return;
    }

    try {
      const party = await createParty.mutateAsync({
        party_type: newPartyType,
        display_name: newPartyName.trim(),
      });
      setSelectedPartyId(party.id);
      setShowNewPartyForm(false);
      toast({ title: 'New party on file', description: `${newPartyName} can now hold shares.` });
    } catch (error) {
      console.error('Failed to create party:', error);
      toast({ title: "Party didn't save", description: error instanceof Error ? error.message : 'Failed to create party', variant: 'destructive' });
    }
  };

  const handleSubmit = async () => {
    if (!selectedPartyId) {
      toast({ title: 'Shareholder needed', description: "Choose who'll hold these shares.", variant: 'destructive' });
      return;
    }

    if (!selectedShareClassId) {
      toast({ title: 'Share class needed', description: 'Choose the class before saving.', variant: 'destructive' });
      return;
    }

    const shares = parseInt(sharesHeld, 10);
    if (isNaN(shares) || shares <= 0) {
      toast({ title: 'Check the share count', description: 'Needs to be a positive whole number.', variant: 'destructive' });
      return;
    }

    try {
      if (isEditing && editingShareholding) {
        await updateShareholding.mutateAsync({
          id: editingShareholding.id,
          companyId,
          shareholder_party_id: selectedPartyId,
          share_class_id: selectedShareClassId,
          shares_held: shares,
          notes: notes.trim() || null,
        });
        toast({ title: 'Shareholding on file' });
      } else {
        await addShareholding.mutateAsync({
          company_id: companyId,
          share_class_id: selectedShareClassId,
          shareholder_party_id: selectedPartyId,
          shares_held: shares,
          notes: notes.trim() || undefined,
        });
        toast({ title: 'Shareholder on the cap table' });
      }
      onOpenChange(false);
    } catch (err) {
      console.error('Failed to save shareholding:', err);
      const message = err instanceof Error ? err.message : 'Failed to save shareholding';
      toast({
        title: "Cap table didn't update",
        description: message,
        variant: 'destructive',
      });
    }
  };

  const selectedShareClass = shareClasses.find((sc) => sc.id === selectedShareClassId);
  const percentOwnership = selectedShareClass && sharesHeld
    ? ((parseInt(sharesHeld, 10) || 0) / selectedShareClass.issued_shares) * 100
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit Shareholder' : 'Add Shareholder'}
          </DialogTitle>
          <DialogDescription>
            Record or update a shareholder's stake in this entity.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Shareholder Selection */}
          {!showNewPartyForm ? (
            <div className="space-y-2">
              <Label>Shareholder</Label>
              <div className="flex gap-2">
                <Select value={selectedPartyId} onValueChange={setSelectedPartyId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select shareholder..." />
                  </SelectTrigger>
                  <SelectContent>
                    {parties?.map((party) => (
                      <SelectItem key={party.id} value={party.id}>
                        <div className="flex items-center gap-2">
                          {party.party_type === 'INDIVIDUAL' ? (
                            <User className="h-3 w-3" />
                          ) : (
                            <Building2 className="h-3 w-3" />
                          )}
                          {party.display_name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button aria-label="Add"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowNewPartyForm(true)}
                  title="Add new"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
              <h4 className="font-medium">Add New Shareholder</h4>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={newPartyName}
                  onChange={(e) => setNewPartyName(e.target.value)}
                  placeholder="e.g., John Smith or Tenure IQ Ltd"
                />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={newPartyType} onValueChange={(v) => setNewPartyType(v as PartyType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PARTY_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          {type.icon}
                          {type.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowNewPartyForm(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateParty} disabled={createParty.isPending}>
                  {createParty.isPending ? 'Creating...' : 'Create'}
                </Button>
              </div>
            </div>
          )}

          {/* Share Class Selection */}
          {shareClasses.length > 1 && (
            <div className="space-y-2">
              <Label>Share Class</Label>
              <Select value={selectedShareClassId} onValueChange={setSelectedShareClassId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {shareClasses.map((sc) => (
                    <SelectItem key={sc.id} value={sc.id}>
                      {sc.name} ({sc.issued_shares.toLocaleString()} issued)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Shares Held */}
          <div className="space-y-2">
            <Label>Shares Held</Label>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min="1"
                value={sharesHeld}
                onChange={(e) => setSharesHeld(e.target.value)}
                className="w-32"
                placeholder="e.g., 33"
              />
              {selectedShareClass && (
                <span className="text-sm text-muted-foreground">
                  of {selectedShareClass.issued_shares.toLocaleString()} = {percentOwnership.toFixed(2)}%
                </span>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : isEditing ? 'Update' : 'Add Shareholder'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
