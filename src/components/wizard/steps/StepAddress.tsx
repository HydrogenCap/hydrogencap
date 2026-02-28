import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { WizardPayload } from '@/lib/wizard/types';

interface StepProps {
  payload: WizardPayload;
  updatePayload: (partial: Partial<WizardPayload>) => void;
}

export function StepAddress({ payload, updatePayload }: StepProps) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="address_line_1">Address line 1 *</Label>
        <Input
          id="address_line_1"
          value={(payload.address_line_1 as string) || ''}
          onChange={(e) => updatePayload({ address_line_1: e.target.value })}
          placeholder="123 High Street"
        />
      </div>
      <div>
        <Label htmlFor="address_line_2">Address line 2</Label>
        <Input
          id="address_line_2"
          value={(payload.address_line_2 as string) || ''}
          onChange={(e) => updatePayload({ address_line_2: e.target.value })}
          placeholder="Flat 4"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="city">City / Town *</Label>
          <Input
            id="city"
            value={(payload.city as string) || ''}
            onChange={(e) => updatePayload({ city: e.target.value })}
            placeholder="London"
          />
        </div>
        <div>
          <Label htmlFor="county">County</Label>
          <Input
            id="county"
            value={(payload.county as string) || ''}
            onChange={(e) => updatePayload({ county: e.target.value })}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="postcode">Postcode *</Label>
          <Input
            id="postcode"
            value={(payload.postcode as string) || ''}
            onChange={(e) => updatePayload({ postcode: e.target.value.toUpperCase() })}
            placeholder="SW1A 1AA"
          />
        </div>
        <div>
          <Label htmlFor="country">Country</Label>
          <Input
            id="country"
            value={(payload.country as string) || 'United Kingdom'}
            onChange={(e) => updatePayload({ country: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}
