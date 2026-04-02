import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { addMonths, format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  COMPLIANCE_TYPES, 
  RESPONSIBLE_PARTIES,
  DEFAULT_REMINDER_DAYS 
} from '@/lib/complianceTypes';
import { useCreateComplianceItem } from '@/hooks/useCompliance';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const EPC_RATINGS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;

interface AddComplianceItemDialogProps {
  propertyId: string;
  defaultType?: string;
  trigger?: React.ReactNode;
}

export function AddComplianceItemDialog({ propertyId, defaultType, trigger }: AddComplianceItemDialogProps) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    compliance_type: defaultType || '',
    custom_type: '',
    issue_date: '',
    expiry_date: '',
    responsible_party: 'Owner',
    notes: '',
    epc_rating: '', // For EPC sync
  });
  
  // Update form when defaultType changes
  React.useEffect(() => {
    if (defaultType && !open) {
      setFormData(prev => ({ ...prev, compliance_type: defaultType }));
    }
  }, [defaultType, open]);

  const { toast } = useToast();
  const createItem = useCreateComplianceItem();

  const handleQuickExpiry = (months: number) => {
    const futureDate = addMonths(new Date(), months);
    setFormData({ ...formData, expiry_date: format(futureDate, 'yyyy-MM-dd') });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const complianceType = formData.compliance_type === 'Other' && formData.custom_type
      ? formData.custom_type
      : formData.compliance_type;

    if (!complianceType) {
      toast({ title: 'Please select a compliance type', variant: 'destructive' });
      return;
    }

    try {
      // === EPC CONSOLIDATION: Sync EPC rating to properties_v2 table ===
      if (complianceType === 'EPC' && formData.epc_rating) {
        const { error: syncError } = await (supabase as any)
          .from('properties_v2')
          .update({ epc_rating: formData.epc_rating })
          .eq('id', propertyId);
        
        if (syncError) {
          console.error('Failed to sync EPC rating:', syncError);
        }
      }

      await createItem.mutateAsync({
        property_id: propertyId,
        compliance_type: complianceType,
        issue_date: formData.issue_date || null,
        expiry_date: formData.expiry_date || null,
        responsible_party: formData.responsible_party,
        notes: formData.epc_rating 
          ? `${formData.notes || ''} Rating: ${formData.epc_rating}`.trim()
          : formData.notes || null,
        reminder_days: DEFAULT_REMINDER_DAYS,
      });

      toast({ title: 'Compliance item added' });
      setOpen(false);
      setFormData({
        compliance_type: '',
        custom_type: '',
        issue_date: '',
        expiry_date: '',
        responsible_party: 'Owner',
        notes: '',
        epc_rating: '',
      });
    } catch (error) {
      toast({ 
        title: 'Failed to add compliance item', 
        variant: 'destructive' 
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Compliance Item
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Compliance Item</DialogTitle>
            <DialogDescription>
              Add a new compliance requirement to track for this property.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Compliance Type *</label>
              <Select 
                value={formData.compliance_type}
                onValueChange={(v) => setFormData({ ...formData, compliance_type: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent>
                  {COMPLIANCE_TYPES.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formData.compliance_type === 'Other' && (
              <div>
                <label className="text-sm font-medium">Custom Type Name *</label>
                <Input
                  value={formData.custom_type}
                  onChange={(e) => setFormData({ ...formData, custom_type: e.target.value })}
                  placeholder="Enter custom type..."
                />
              </div>
            )}

            {/* EPC Rating field - only shown for EPC compliance type */}
            {formData.compliance_type === 'EPC' && (
              <div>
                <label className="text-sm font-medium">EPC Rating</label>
                <Select 
                  value={formData.epc_rating}
                  onValueChange={(v) => setFormData({ ...formData, epc_rating: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select rating..." />
                  </SelectTrigger>
                  <SelectContent>
                    {EPC_RATINGS.map(rating => (
                      <SelectItem key={rating} value={rating}>{rating}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  This will also update the property's EPC rating
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Issue Date</label>
                <Input
                  type="date"
                  value={formData.issue_date}
                  onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Expiry Date</label>
                <Input
                  type="date"
                  value={formData.expiry_date}
                  onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                />
                <div className="flex gap-2 mt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => handleQuickExpiry(6)}
                  >
                    +6 months
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => handleQuickExpiry(12)}
                  >
                    +12 months
                  </Button>
                </div>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Responsible Party</label>
              <Select 
                value={formData.responsible_party}
                onValueChange={(v) => setFormData({ ...formData, responsible_party: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RESPONSIBLE_PARTIES.map(party => (
                    <SelectItem key={party} value={party}>{party}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Notes</label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
                placeholder="Optional notes..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createItem.isPending}>
              {createItem.isPending ? 'Adding...' : 'Add Item'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
