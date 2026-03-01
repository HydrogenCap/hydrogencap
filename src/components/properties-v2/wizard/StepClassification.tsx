import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PROPERTY_TYPES, LIFECYCLE_STAGES } from '@/hooks/usePropertiesV2';
import { useLegalEntities } from '@/hooks/useLegalEntities';
import type { WizardData } from './types';

interface Props {
  data: WizardData;
  onChange: (partial: Partial<WizardData>) => void;
}

const ENTITY_TYPE_COLORS: Record<string, string> = {
  spv: 'text-blue-600', personal: 'text-emerald-600',
  joint_venture: 'text-purple-600', trust: 'text-amber-600',
};

const TYPE_DESCRIPTIONS: Record<string, string> = {
  hmo_licensed: '3+ tenants from 2+ households, local authority licence held',
  hmo_mandatory: '5+ tenants from 2+ households, mandatory licence',
  single_let: 'Let to a single household',
  multi_unit_freehold: 'Multiple self-contained units',
  commercial: 'Commercial or retail use',
  mixed_use: 'Combination of residential and commercial',
};

const STAGE_ICONS: Record<string, string> = {
  pipeline: '🔍', acquisition: '📋', refurbishment: '🔨',
  letting: '📢', stabilised: '✅', disposal: '🏷️',
};

export function StepClassification({ data, onChange }: Props) {
  const { data: entities } = useLegalEntities();
  const activeEntities = entities?.filter(e => e.status === 'active') || [];
  const isHmo = ['hmo_licensed', 'hmo_mandatory'].includes(data.property_type);

  return (
    <div className="space-y-5">
      <div>
        <Label className="text-sm font-medium">Owning Entity *</Label>
        <Select value={data.entity_id} onValueChange={v => onChange({ entity_id: v })}>
          <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select entity" /></SelectTrigger>
          <SelectContent>
            {activeEntities.map(e => (
              <SelectItem key={e.id} value={e.id}>
                <span className={ENTITY_TYPE_COLORS[e.entity_type]}>{e.entity_name}</span>
                <span className="text-xs text-muted-foreground ml-2">({e.entity_type.replace('_', ' ')})</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-sm font-medium">Property Type *</Label>
        <Select value={data.property_type} onValueChange={v => onChange({ property_type: v })}>
          <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PROPERTY_TYPES.map(t => (
              <SelectItem key={t.value} value={t.value}>
                <div>
                  <span>{t.label}</span>
                  {TYPE_DESCRIPTIONS[t.value] && (
                    <p className="text-xs text-muted-foreground">{TYPE_DESCRIPTIONS[t.value]}</p>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-sm font-medium">Lifecycle Stage *</Label>
        <Select value={data.lifecycle_stage} onValueChange={v => onChange({ lifecycle_stage: v })}>
          <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
          <SelectContent>
            {LIFECYCLE_STAGES.map(s => (
              <SelectItem key={s.value} value={s.value}>
                {STAGE_ICONS[s.value]} {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between py-2">
        <div>
          <Label className="text-sm font-medium">Has Gas Supply</Label>
          <p className="text-xs text-muted-foreground">If off, gas safety certificate won't be required</p>
        </div>
        <Switch checked={data.has_gas_supply} onCheckedChange={v => onChange({ has_gas_supply: v })} />
      </div>

      {isHmo && (
        <div>
          <Label className="text-sm font-medium">HMO Licence Number</Label>
          <Input
            value={data.hmo_licence_number}
            onChange={e => onChange({ hmo_licence_number: e.target.value })}
            placeholder="e.g. HMO/2024/12345"
            className="mt-1.5"
          />
          <p className="text-xs text-muted-foreground mt-1">Issued by your local authority</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Year Built</Label>
          <Input type="number" value={data.year_built} onChange={e => onChange({ year_built: e.target.value })} placeholder="e.g. 1920" />
        </div>
        <div>
          <Label>Total Floors</Label>
          <Input type="number" value={data.total_floors} onChange={e => onChange({ total_floors: e.target.value })} placeholder="e.g. 3" />
        </div>
      </div>
    </div>
  );
}
