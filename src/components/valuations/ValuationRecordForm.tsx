import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useCreateValuationHistory, type ValuationHistoryInsert } from '@/hooks/useValuationEvidence';

interface ValuationRecordFormProps {
  propertyId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EMPTY_FORM: Omit<ValuationHistoryInsert, 'property_id'> = {
  valuation_date: new Date().toISOString().split('T')[0],
  value: 0,
  basis_of_value: 'market_value',
  valuer_name: '',
  valuer_firm: '',
  valuation_type: 'desktop',
  key_assumptions: '',
  esg_considerations: '',
  document_url: '',
};

const BASIS_OPTIONS = [
  { value: 'market_value', label: 'Market Value' },
  { value: 'investment_value', label: 'Investment Value' },
  { value: 'fair_value', label: 'Fair Value' },
];

const TYPE_OPTIONS = [
  { value: 'desktop', label: 'Desktop' },
  { value: 'drive_by', label: 'Drive-by' },
  { value: 'full_inspection', label: 'Full Inspection' },
  { value: 'rics_red_book', label: 'RICS Red Book' },
];

export function ValuationRecordForm({ propertyId, open, onOpenChange }: ValuationRecordFormProps) {
  const createValuation = useCreateValuationHistory();
  const [form, setForm] = useState(EMPTY_FORM);

  const handleSubmit = () => {
    createValuation.mutate(
      {
        property_id: propertyId,
        valuation_date: form.valuation_date,
        value: form.value,
        basis_of_value: form.basis_of_value,
        valuer_name: form.valuer_name || null,
        valuer_firm: form.valuer_firm || null,
        valuation_type: form.valuation_type,
        key_assumptions: form.key_assumptions || null,
        esg_considerations: form.esg_considerations || null,
        document_url: form.document_url || null,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          setForm(EMPTY_FORM);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record Valuation</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Valuation Date *</Label>
              <Input
                type="date"
                value={form.valuation_date}
                onChange={(e) => setForm((f) => ({ ...f, valuation_date: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>Value (£) *</Label>
              <Input
                type="number"
                value={form.value || ''}
                onChange={(e) => setForm((f) => ({ ...f, value: Number(e.target.value) }))}
                placeholder="350000"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Basis of Value</Label>
              <Select value={form.basis_of_value} onValueChange={(v) => setForm((f) => ({ ...f, basis_of_value: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BASIS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Valuation Type</Label>
              <Select value={form.valuation_type} onValueChange={(v) => setForm((f) => ({ ...f, valuation_type: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Valuer Name</Label>
              <Input
                value={form.valuer_name ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, valuer_name: e.target.value }))}
                placeholder="John Smith MRICS"
              />
            </div>
            <div className="grid gap-2">
              <Label>Valuer Firm</Label>
              <Input
                value={form.valuer_firm ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, valuer_firm: e.target.value }))}
                placeholder="Knight Frank"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Key Assumptions</Label>
            <Textarea
              value={form.key_assumptions ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, key_assumptions: e.target.value }))}
              rows={3}
              placeholder="Market conditions, comparable evidence basis, special assumptions..."
            />
          </div>

          <div className="grid gap-2">
            <Label>ESG Considerations</Label>
            <Textarea
              value={form.esg_considerations ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, esg_considerations: e.target.value }))}
              rows={2}
              placeholder="EPC rating impact, flood risk, sustainability factors..."
            />
          </div>

          <div className="grid gap-2">
            <Label>Report URL</Label>
            <Input
              value={form.document_url ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, document_url: e.target.value }))}
              placeholder="https://..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!form.value || !form.valuation_date || createValuation.isPending}>
            {createValuation.isPending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>
            ) : (
              'Record Valuation'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
