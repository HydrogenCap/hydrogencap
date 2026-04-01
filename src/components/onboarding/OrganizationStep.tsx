import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Building2 } from 'lucide-react';
import { TEXT } from '@/lib/design-tokens';

const PROPERTY_TYPE_OPTIONS = [
  { value: 'hmo', label: 'HMO' },
  { value: 'btl', label: 'Buy-to-Let' },
  { value: 'development', label: 'Development' },
  { value: 'commercial', label: 'Commercial' },
];

interface OrganizationStepProps {
  orgName: string;
  onOrgNameChange: (value: string) => void;
  propertyTypes: string[];
  onTogglePropertyType: (value: string) => void;
  regionFocus: string;
  onRegionFocusChange: (value: string) => void;
}

export function OrganizationStep({
  orgName,
  onOrgNameChange,
  propertyTypes,
  onTogglePropertyType,
  regionFocus,
  onRegionFocusChange,
}: OrganizationStepProps) {
  return (
    <div className="space-y-5">
      <div className="text-center space-y-1">
        <Building2 className="mx-auto h-10 w-10 text-primary" />
        <h2 className={TEXT.sectionHeading}>Your Organisation</h2>
        <p className={TEXT.label}>Name your portfolio or company.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="orgName">Organisation / Company name</Label>
        <Input
          id="orgName"
          value={orgName}
          onChange={e => onOrgNameChange(e.target.value)}
          placeholder="e.g. Smith Property Holdings"
          className="bg-input border-border"
          autoFocus
        />
      </div>

      <div className="space-y-2">
        <Label>Property types you manage</Label>
        <div className="grid grid-cols-2 gap-2">
          {PROPERTY_TYPE_OPTIONS.map(t => (
            <label
              key={t.value}
              className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors text-sm ${
                propertyTypes.includes(t.value)
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-muted-foreground/30'
              }`}
            >
              <Checkbox
                checked={propertyTypes.includes(t.value)}
                onCheckedChange={() => onTogglePropertyType(t.value)}
              />
              {t.label}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="regionFocus">Region / Area focus</Label>
        <Input
          id="regionFocus"
          value={regionFocus}
          onChange={e => onRegionFocusChange(e.target.value)}
          placeholder="e.g. South West England"
          className="bg-input border-border"
        />
      </div>
    </div>
  );
}
