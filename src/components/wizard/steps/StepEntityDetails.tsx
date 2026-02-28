import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { WizardPayload } from '@/lib/wizard/types';

interface StepProps {
  payload: WizardPayload;
  updatePayload: (partial: Partial<WizardPayload>) => void;
}

const ENTITY_TYPES = [
  { value: 'ltd_company', label: 'Limited Company' },
  { value: 'llp', label: 'LLP' },
  { value: 'sole_trader', label: 'Sole Trader' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'trust', label: 'Trust' },
  { value: 'individual', label: 'Individual' },
  { value: 'overseas', label: 'Overseas Entity' },
];

export function StepEntityDetails({ payload, updatePayload }: StepProps) {
  return (
    <div className="space-y-5">
      <div>
        <Label htmlFor="entity_name">Entity name *</Label>
        <Input
          id="entity_name"
          value={(payload.entity_name as string) || ''}
          onChange={(e) => updatePayload({ entity_name: e.target.value })}
          placeholder="Acme Properties Ltd"
        />
      </div>

      <div>
        <Label>Entity type *</Label>
        <Select
          value={(payload.entity_type as string) || ''}
          onValueChange={(v) => updatePayload({ entity_type: v })}
        >
          <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
          <SelectContent>
            {ENTITY_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {payload.entity_type === 'ltd_company' && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="company_number">Company number</Label>
            <Input
              id="company_number"
              value={(payload.company_number as string) || ''}
              onChange={(e) => updatePayload({ company_number: e.target.value })}
              placeholder="12345678"
            />
          </div>
          <div>
            <Label htmlFor="incorporation_date">Incorporation date</Label>
            <Input
              id="incorporation_date"
              type="date"
              value={(payload.incorporation_date as string) || ''}
              onChange={(e) => updatePayload({ incorporation_date: e.target.value })}
            />
          </div>
        </div>
      )}

      <div>
        <Label htmlFor="registered_address">Registered address</Label>
        <Textarea
          id="registered_address"
          value={(payload.registered_address as string) || ''}
          onChange={(e) => updatePayload({ registered_address: e.target.value })}
          placeholder="Full registered address"
          rows={3}
        />
      </div>

      <div>
        <Label htmlFor="entity_notes">Notes</Label>
        <Textarea
          id="entity_notes"
          value={(payload.entity_notes as string) || ''}
          onChange={(e) => updatePayload({ entity_notes: e.target.value })}
          placeholder="Any additional notes…"
          rows={2}
        />
      </div>
    </div>
  );
}
