import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Home } from 'lucide-react';
import { AddressAutocomplete, type AddressData } from '@/components/maps/AddressAutocomplete';
import { TEXT } from '@/lib/design-tokens';

const PROPERTY_TYPES = [
  { value: 'single_let', label: 'Single Let (BTL)' },
  { value: 'hmo_licensed', label: 'HMO (Licensed)' },
  { value: 'hmo_mandatory', label: 'HMO (Mandatory)' },
  { value: 'multi_unit', label: 'Multi-Unit' },
];

interface FirstPropertyStepProps {
  address: string;
  onAddressChange: (value: string) => void;
  onAddressSelect: (data: AddressData) => void;
  postcode: string;
  onPostcodeChange: (value: string) => void;
  beds: string;
  onBedsChange: (value: string) => void;
  propertyType: string;
  onPropertyTypeChange: (value: string) => void;
  currentValue: string;
  onCurrentValueChange: (value: string) => void;
}

export function FirstPropertyStep({
  address,
  onAddressChange,
  onAddressSelect,
  postcode,
  onPostcodeChange,
  beds,
  onBedsChange,
  propertyType,
  onPropertyTypeChange,
  currentValue,
  onCurrentValueChange,
}: FirstPropertyStepProps) {
  return (
    <div className="space-y-5">
      <div className="text-center space-y-1">
        <Home className="mx-auto h-10 w-10 text-primary" />
        <h2 className={TEXT.sectionHeading}>Add your first property</h2>
        <p className={TEXT.label}>You can skip this and add properties later.</p>
      </div>

      <div className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="address">Address</Label>
          <AddressAutocomplete
            value={address}
            onChange={onAddressChange}
            onAddressSelect={onAddressSelect}
            placeholder="Start typing an address..."
            className="bg-input border-border"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="postcode">Postcode</Label>
            <Input
              id="postcode"
              value={postcode}
              onChange={e => onPostcodeChange(e.target.value)}
              placeholder="SW1A 2AA"
              className="bg-input border-border"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="beds">Bedrooms</Label>
            <Input
              id="beds"
              type="number"
              min="1"
              value={beds}
              onChange={e => onBedsChange(e.target.value)}
              placeholder="e.g. 3"
              className="bg-input border-border"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Property type</Label>
          <Select value={propertyType} onValueChange={onPropertyTypeChange}>
            <SelectTrigger className="bg-input border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROPERTY_TYPES.map(t => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="currentValue">Current value (£)</Label>
          <Input
            id="currentValue"
            type="number"
            min="0"
            value={currentValue}
            onChange={e => onCurrentValueChange(e.target.value)}
            placeholder="e.g. 250000"
            className="bg-input border-border"
          />
        </div>
      </div>
    </div>
  );
}
