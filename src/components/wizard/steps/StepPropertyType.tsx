import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import type { WizardPayload } from '@/lib/wizard/types';

interface StepProps {
  payload: WizardPayload;
  updatePayload: (partial: Partial<WizardPayload>) => void;
}

const PROPERTY_TYPES = [
  { value: 'single_let', label: 'Single Let (AST)' },
  { value: 'hmo_licensed', label: 'HMO – Licensed' },
  { value: 'hmo_mandatory', label: 'HMO – Mandatory' },
  { value: 'multi_unit_freehold', label: 'Multi-Unit Freehold Block' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'mixed_use', label: 'Mixed Use' },
  { value: 'serviced_accommodation', label: 'Serviced Accommodation' },
  { value: 'development', label: 'Development Site' },
];

const LIFECYCLE_STAGES = [
  { value: 'acquisition', label: 'Acquisition' },
  { value: 'refurb', label: 'Refurbishment' },
  { value: 'stabilised', label: 'Stabilised / Letting' },
  { value: 'disposal', label: 'Disposal' },
];

export function StepPropertyType({ payload, updatePayload }: StepProps) {
  return (
    <div className="space-y-5">
      <div>
        <Label>Property type *</Label>
        <Select
          value={(payload.property_type as string) || ''}
          onValueChange={(v) => updatePayload({ property_type: v })}
        >
          <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
          <SelectContent>
            {PROPERTY_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Lifecycle stage *</Label>
        <Select
          value={(payload.lifecycle_stage as string) || ''}
          onValueChange={(v) => updatePayload({ lifecycle_stage: v })}
        >
          <SelectTrigger><SelectValue placeholder="Select stage" /></SelectTrigger>
          <SelectContent>
            {LIFECYCLE_STAGES.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border p-4">
        <div>
          <Label htmlFor="has_gas">Has gas supply?</Label>
          <p className="text-xs text-muted-foreground">Determines Gas Safety Certificate requirement</p>
        </div>
        <Switch
          id="has_gas"
          checked={!!payload.has_gas_supply}
          onCheckedChange={(v) => updatePayload({ has_gas_supply: v })}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="year_built">Year built</Label>
          <Input
            id="year_built"
            type="number"
            value={(payload.year_built as number) || ''}
            onChange={(e) => updatePayload({ year_built: e.target.value ? Number(e.target.value) : undefined })}
            placeholder="1990"
          />
        </div>
        <div>
          <Label htmlFor="total_lettable_rooms">Total lettable rooms</Label>
          <Input
            id="total_lettable_rooms"
            type="number"
            value={(payload.total_lettable_rooms as number) || ''}
            onChange={(e) => updatePayload({ total_lettable_rooms: e.target.value ? Number(e.target.value) : undefined })}
            placeholder="5"
          />
        </div>
      </div>
    </div>
  );
}
