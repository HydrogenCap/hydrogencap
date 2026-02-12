import React, { useState, useEffect } from 'react';
import { Building2, User, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  usePropertyBeneficialOwnership,
  useAddOwnershipLink,
  useUpdateOwnershipLink,
  calculateOwnershipTotal,
  type OwnershipLink,
  type SubjectType,
} from '@/hooks/useOwnershipLinks';
import { useParties, useCreateParty, type Party } from '@/hooks/useParties';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface UnifiedOwnershipEditorProps {
  subjectType: SubjectType;
  subjectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingLink?: OwnershipLink | null;
}

export function UnifiedOwnershipEditor({
  subjectType,
  subjectId,
  open,
  onOpenChange,
  editingLink,
}: UnifiedOwnershipEditorProps) {
  const { data: existingLinks } = usePropertyBeneficialOwnership(
    subjectType === 'PROPERTY' ? subjectId : undefined
  );
  const { data: parties } = useParties();
  const addLink = useAddOwnershipLink();
  const updateLink = useUpdateOwnershipLink();
  const createParty = useCreateParty();
  const { toast } = useToast();

  const [ownerPartyId, setOwnerPartyId] = useState<string>('');
  const [percent, setPercent] = useState<string>('');
  const [shares, setShares] = useState<string>('');
  const [effectiveFrom, setEffectiveFrom] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [partySearchOpen, setPartySearchOpen] = useState(false);

  // New party creation
  const [showNewParty, setShowNewParty] = useState(false);
  const [newPartyName, setNewPartyName] = useState('');
  const [newPartyType, setNewPartyType] = useState<'INDIVIDUAL' | 'COMPANY'>('INDIVIDUAL');

  // Reset form when dialog opens/closes or editing changes
  useEffect(() => {
    if (open) {
      if (editingLink) {
        setOwnerPartyId(editingLink.owner_party_id);
        setPercent(String(editingLink.percent));
        setShares(editingLink.shares ? String(editingLink.shares) : '');
        setEffectiveFrom(editingLink.effective_from || '');
        setNotes(editingLink.notes || '');
      } else {
        setOwnerPartyId('');
        setPercent('');
        setShares('');
        setEffectiveFrom('');
        setNotes('');
      }
      setShowNewParty(false);
      setNewPartyName('');
      setNewPartyType('INDIVIDUAL');
    }
  }, [open, editingLink]);

  // Calculate remaining percentage
  const currentTotal = calculateOwnershipTotal(existingLinks || []);
  const usedByOthers = editingLink 
    ? currentTotal - Number(editingLink.percent)
    : currentTotal;
  const remaining = 100 - usedByOthers;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const percentNum = parseFloat(percent);
    if (isNaN(percentNum) || percentNum <= 0 || percentNum > 100) {
      toast({ title: 'Error', description: 'Percentage must be between 0 and 100', variant: 'destructive' });
      return;
    }

    if (percentNum > remaining + 0.01 && !editingLink) {
      toast({ 
        title: 'Error', 
        description: `Maximum available is ${remaining.toFixed(2)}%`, 
        variant: 'destructive' 
      });
      return;
    }

    try {
      let finalPartyId = ownerPartyId;

      // Create new party if needed
      if (showNewParty && newPartyName.trim()) {
        const newParty = await createParty.mutateAsync({
          display_name: newPartyName.trim(),
          party_type: newPartyType,
        });
        finalPartyId = newParty.id;
      }

      if (!finalPartyId) {
        toast({ title: 'Error', description: 'Please select or create an owner', variant: 'destructive' });
        return;
      }

      if (editingLink) {
        await updateLink.mutateAsync({
          id: editingLink.id,
          owner_party_id: finalPartyId,
          percent: percentNum,
          shares: shares ? parseFloat(shares) : null,
          effective_from: effectiveFrom || null,
          notes: notes.trim() || null,
        });
        toast({ title: 'Ownership updated' });
      } else {
        await addLink.mutateAsync({
          subject_type: subjectType,
          subject_id: subjectId,
          owner_party_id: finalPartyId,
          ownership_type: subjectType === 'PROPERTY' ? 'BENEFICIAL' : 'SHAREHOLDING',
          percent: percentNum,
          shares: shares ? parseFloat(shares) : null,
          effective_from: effectiveFrom || null,
          notes: notes.trim() || null,
        });
        toast({ title: 'Owner added' });
      }

      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save ownership';
      toast({ 
        title: 'Error', 
        description: message, 
        variant: 'destructive' 
      });
    }
  };

  const selectedParty = parties?.find(p => p.id === ownerPartyId);

  // All parties - cmdk handles filtering based on the value prop
  const allParties = parties || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editingLink ? 'Edit Ownership' : 'Add Beneficial Owner'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Owner Selection */}
          <div className="space-y-2">
            <Label>Owner</Label>
            {showNewParty ? (
              <div className="space-y-3 p-3 border rounded-lg bg-muted/50">
                <div className="space-y-2">
                  <Label className="text-xs">Name</Label>
                  <Input
                    value={newPartyName}
                    onChange={(e) => setNewPartyName(e.target.value)}
                    placeholder="Enter name..."
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Type</Label>
                  <Select value={newPartyType} onValueChange={(v) => setNewPartyType(v as 'INDIVIDUAL' | 'COMPANY')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INDIVIDUAL">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          Individual
                        </div>
                      </SelectItem>
                      <SelectItem value="COMPANY">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          Company
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowNewParty(false);
                    setNewPartyName('');
                  }}
                >
                  Cancel — select existing instead
                </Button>
              </div>
            ) : (
              <Popover open={partySearchOpen} onOpenChange={setPartySearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !ownerPartyId && 'text-muted-foreground'
                    )}
                  >
                    {selectedParty ? (
                      <div className="flex items-center gap-2">
                        {selectedParty.party_type === 'COMPANY' ? (
                          <Building2 className="h-4 w-4" />
                        ) : (
                          <User className="h-4 w-4" />
                        )}
                        {selectedParty.display_name}
                      </div>
                    ) : (
                      'Select owner...'
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                  <Command>
                    <CommandInput
                      placeholder="Search parties..."
                    />
                    <CommandList>
                      <CommandEmpty>
                        <div className="p-2 text-center">
                          <p className="text-sm text-muted-foreground mb-2">No parties found</p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setShowNewParty(true);
                              setPartySearchOpen(false);
                            }}
                          >
                            + Create new party
                          </Button>
                        </div>
                      </CommandEmpty>
                      <CommandGroup>
                        {allParties.map((party) => (
                          <CommandItem
                            key={party.id}
                            value={`${party.display_name} ${party.company_number || ''}`}
                            onSelect={() => {
                              setOwnerPartyId(party.id);
                              setPartySearchOpen(false);
                            }}
                          >
                            <div className="flex items-center gap-2 flex-1">
                              {party.party_type === 'COMPANY' ? (
                                <Building2 className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <User className="h-4 w-4 text-muted-foreground" />
                              )}
                              <div>
                                <p className="font-medium">{party.display_name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {party.party_type}
                                  {party.company_number && ` • ${party.company_number}`}
                                </p>
                              </div>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                    <div className="p-2 border-t">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          setShowNewParty(true);
                          setPartySearchOpen(false);
                        }}
                      >
                        + Create new party
                      </Button>
                    </div>
                  </Command>
                </PopoverContent>
              </Popover>
            )}
          </div>

          {/* Percentage */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Ownership %</Label>
              <span className="text-xs text-muted-foreground">
                {remaining.toFixed(1)}% available
              </span>
            </div>
            <Input
              type="number"
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
              placeholder="e.g. 50"
              min="0.01"
              max="100"
              step="0.01"
              required
            />
            {parseFloat(percent) > remaining && !editingLink && (
              <Alert variant="destructive" className="py-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Exceeds available {remaining.toFixed(1)}%
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Shares (optional, for company ownership) */}
          {subjectType === 'COMPANY' && (
            <div className="space-y-2">
              <Label>Shares (optional)</Label>
              <Input
                type="number"
                value={shares}
                onChange={(e) => setShares(e.target.value)}
                placeholder="Number of shares held"
                min="0"
              />
            </div>
          )}

          {/* Effective From */}
          <div className="space-y-2">
            <Label>Effective From (optional)</Label>
            <Input
              type="date"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
            />
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

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={addLink.isPending || updateLink.isPending || createParty.isPending}
            >
              {addLink.isPending || updateLink.isPending || createParty.isPending
                ? 'Saving...'
                : editingLink
                ? 'Update'
                : 'Add Owner'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
