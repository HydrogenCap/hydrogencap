import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useOrganization } from '@/hooks/useOrganization';
import {
  useCreateLegalEntity,
  useUpdateLegalEntity,
  type LegalEntity,
} from '@/hooks/useLegalEntities';
import { useToast } from '@/hooks/use-toast';

interface EntityFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingEntity?: LegalEntity | null;
}

const ENTITY_TYPES = [
  { value: 'spv', label: 'SPV' },
  { value: 'personal', label: 'Personal' },
  { value: 'joint_venture', label: 'Joint Venture' },
  { value: 'trust', label: 'Trust' },
] as const;

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'dormant', label: 'Dormant' },
  { value: 'dissolved', label: 'Dissolved' },
] as const;

export function EntityFormModal({ open, onOpenChange, editingEntity }: EntityFormModalProps) {
  const { toast } = useToast();
  const { data: org } = useOrganization();
  const createEntity = useCreateLegalEntity();
  const updateEntity = useUpdateLegalEntity();
  const isEditing = !!editingEntity;

  const [form, setForm] = useState({
    entity_name: '',
    entity_type: 'spv' as LegalEntity['entity_type'],
    company_number: '',
    incorporation_date: '',
    registered_address: '',
    corporation_tax_ref: '',
    vat_registered: false,
    vat_number: '',
    status: 'active' as LegalEntity['status'],
    notes: '',
  });

  useEffect(() => {
    if (open) {
      if (editingEntity) {
        setForm({
          entity_name: editingEntity.entity_name,
          entity_type: editingEntity.entity_type,
          company_number: editingEntity.company_number || '',
          incorporation_date: editingEntity.incorporation_date || '',
          registered_address: editingEntity.registered_address || '',
          corporation_tax_ref: editingEntity.corporation_tax_ref || '',
          vat_registered: editingEntity.vat_registered,
          vat_number: editingEntity.vat_number || '',
          status: editingEntity.status,
          notes: editingEntity.notes || '',
        });
      } else {
        setForm({
          entity_name: '',
          entity_type: 'spv',
          company_number: '',
          incorporation_date: '',
          registered_address: '',
          corporation_tax_ref: '',
          vat_registered: false,
          vat_number: '',
          status: 'active',
          notes: '',
        });
      }
    }
  }, [open, editingEntity]);

  const isSPV = form.entity_type === 'spv';
  const isPending = createEntity.isPending || updateEntity.isPending;

  const handleSubmit = async () => {
    if (!form.entity_name.trim()) {
      toast({ title: 'Error', description: 'Entity name is required', variant: 'destructive' });
      return;
    }
    if (!org?.id) return;

    const payload = {
      org_id: org.id,
      entity_name: form.entity_name.trim(),
      entity_type: form.entity_type,
      company_number: isSPV && form.company_number.trim() ? form.company_number.trim() : null,
      incorporation_date: isSPV && form.incorporation_date ? form.incorporation_date : null,
      registered_address: form.registered_address.trim() || null,
      corporation_tax_ref: isSPV && form.corporation_tax_ref.trim() ? form.corporation_tax_ref.trim() : null,
      vat_registered: form.vat_registered,
      vat_number: form.vat_registered && form.vat_number.trim() ? form.vat_number.trim() : null,
      status: form.status,
      notes: form.notes.trim() || null,
    };

    try {
      if (isEditing && editingEntity) {
        await updateEntity.mutateAsync({ id: editingEntity.id, ...payload });
        toast({ title: 'Entity updated' });
      } else {
        await createEntity.mutateAsync(payload);
        toast({ title: 'Entity created' });
      }
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const update = (field: string, value: any) => setForm(prev => ({ ...prev, [field]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Entity' : 'Add Entity'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Entity Name *</Label>
            <Input value={form.entity_name} onChange={(e) => update('entity_name', e.target.value)} placeholder="e.g. Hydrogen Capital Ltd" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Entity Type *</Label>
              <Select value={form.entity_type} onValueChange={(v) => update('entity_type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ENTITY_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => update('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isSPV && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Company Number</Label>
                  <Input value={form.company_number} onChange={(e) => update('company_number', e.target.value)} placeholder="e.g. 12345678" />
                </div>
                <div className="space-y-2">
                  <Label>Incorporation Date</Label>
                  <Input type="date" value={form.incorporation_date} onChange={(e) => update('incorporation_date', e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Corporation Tax Reference</Label>
                <Input value={form.corporation_tax_ref} onChange={(e) => update('corporation_tax_ref', e.target.value)} placeholder="UTR number" />
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label>Registered Address</Label>
            <Input value={form.registered_address} onChange={(e) => update('registered_address', e.target.value)} placeholder="Registered office address" />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label>VAT Registered</Label>
              <p className="text-xs text-muted-foreground">Is this entity registered for VAT?</p>
            </div>
            <Switch checked={form.vat_registered} onCheckedChange={(v) => update('vat_registered', v)} />
          </div>

          {form.vat_registered && (
            <div className="space-y-2">
              <Label>VAT Number</Label>
              <Input value={form.vat_number} onChange={(e) => update('vat_number', e.target.value)} placeholder="GB 123 4567 89" />
            </div>
          )}

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(e) => update('notes', e.target.value)} placeholder="Any additional notes..." rows={3} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? 'Saving...' : isEditing ? 'Update' : 'Add Entity'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
