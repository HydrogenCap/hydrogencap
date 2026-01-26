import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
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

interface AddComplianceItemDialogProps {
  propertyId: string;
}

export function AddComplianceItemDialog({ propertyId }: AddComplianceItemDialogProps) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    compliance_type: '',
    custom_type: '',
    issue_date: '',
    expiry_date: '',
    responsible_party: 'COHO',
    is_coho_required: true,
    notes: '',
  });

  const { toast } = useToast();
  const createItem = useCreateComplianceItem();

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
      await createItem.mutateAsync({
        property_id: propertyId,
        compliance_type: complianceType,
        issue_date: formData.issue_date || null,
        expiry_date: formData.expiry_date || null,
        responsible_party: formData.responsible_party,
        is_coho_required: formData.is_coho_required,
        notes: formData.notes || null,
        reminder_days: DEFAULT_REMINDER_DAYS,
      });

      toast({ title: 'Compliance item added' });
      setOpen(false);
      setFormData({
        compliance_type: '',
        custom_type: '',
        issue_date: '',
        expiry_date: '',
        responsible_party: 'COHO',
        is_coho_required: true,
        notes: '',
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
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Compliance Item
        </Button>
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

            <div className="flex items-center gap-2">
              <Checkbox
                id="coho_required"
                checked={formData.is_coho_required}
                onCheckedChange={(checked) => 
                  setFormData({ ...formData, is_coho_required: checked === true })
                }
              />
              <label htmlFor="coho_required" className="text-sm">
                COHO Required
              </label>
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
