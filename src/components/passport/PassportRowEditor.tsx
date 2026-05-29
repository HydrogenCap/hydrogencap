import { useState } from 'react';
import { ChevronDown, ChevronUp, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useUpdateCoreIdentity, useTitleNumbers, useAddTitleNumber, useRemoveTitleNumber, PROPERTY_TYPES, CONSTRUCTION_TYPES, LISTED_STATUSES, formatUKPostcode } from '@/hooks/useCoreIdentity';
import { useUpsertPassport } from '@/hooks/usePropertyPassport';
import type { PropertyPassport } from '@/hooks/usePropertyPassport';
import { toast } from "sonner";

interface Property {
  id: string;
  property_name: string | null;
  address_line: string;
  address_line_1?: string;
  address_line_2?: string | null;
  address_line2?: string | null;
  town_city?: string | null;
  city?: string | null;
  county: string | null;
  postcode: string | null;
  uprn: string | null;
  planning_authority: string | null;
  property_type: string | null;
  listed_status: string | null;
  conservation_area: boolean | null;
}

interface PassportRowEditorProps {
  property: Property;
  passport?: PropertyPassport | null;
  isExpanded: boolean;
  onToggle: () => void;
}

export function PassportRowEditor({ property, passport, isExpanded, onToggle }: PassportRowEditorProps) {
  const updateMutation = useUpdateCoreIdentity();
  const upsertPassport = useUpsertPassport();
  const { data: titleNumbers = [] } = useTitleNumbers(property.id);
  const addTitleNumber = useAddTitleNumber();
  const removeTitleNumber = useRemoveTitleNumber();

  // Identity fields → save to properties table
  const [formData, setFormData] = useState({
    property_name: property.property_name || '',
    address_line: property.address_line || '',
    address_line2: property.address_line2 || '',
    town_city: property.town_city || '',
    county: property.county || '',
    postcode: property.postcode || '',
    uprn: property.uprn || '',
    planning_authority: property.planning_authority || '',
    property_type: property.property_type || '',
    listed_status: property.listed_status || 'Not listed',
    conservation_area: property.conservation_area || false,
  });

  // Building classification + operational fields → save to property_passport table
  const [passportData, setPassportData] = useState({
    construction_type: passport?.construction_type || '',
    built_in_year: passport?.built_in_year?.toString() || '',
    electric_meter_location: passport?.electric_meter_location || '',
    electric_meter_number: passport?.electric_meter_number || '',
    gas_meter_location: passport?.gas_meter_location || '',
    gas_meter_number: passport?.gas_meter_number || '',
  });

  const [newTitleNumber, setNewTitleNumber] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Save identity fields to properties table
      await updateMutation.mutateAsync({
        propertyId: property.id,
        data: {
          ...formData,
          postcode: formData.postcode ? formatUKPostcode(formData.postcode) : null,
        },
      });

      // Save building classification + operational fields to property_passport table
      await upsertPassport.mutateAsync({
        property_id: property.id,
        construction_type: passportData.construction_type || null,
        built_in_year: passportData.built_in_year ? parseInt(passportData.built_in_year) : null,
        electric_meter_location: passportData.electric_meter_location || null,
        electric_meter_number: passportData.electric_meter_number || null,
        gas_meter_location: passportData.gas_meter_location || null,
        gas_meter_number: passportData.gas_meter_number || null,
      });

      toast.success('All saved', { description: 'Property identity and passport are up to date.' });
    } catch (_error) {
      toast.error("Changes didn't save", { description: "Give it another go — your edits are still here." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddTitleNumber = async () => {
    if (!newTitleNumber.trim()) return;
    try {
      await addTitleNumber.mutateAsync({ propertyId: property.id, titleNumber: newTitleNumber });
      setNewTitleNumber('');
    } catch (_error) {
      toast.error("Title number didn't add", { description: "Try again — Land Registry didn't accept it." });
    }
  };

  const handleRemoveTitleNumber = async (id: string) => {
    try {
      await removeTitleNumber.mutateAsync({ id, propertyId: property.id });
    } catch (_error) {
      toast.error("Title number didn't remove", { description: 'Give it another go.' });
    }
  };

  if (!isExpanded) {
    return (
      <Button variant="ghost" size="sm" onClick={onToggle} className="gap-1">
        <ChevronDown className="h-4 w-4" />
        Edit
      </Button>
    );
  }

  return (
    <div className="bg-muted/30 border border-border rounded-lg p-4 mt-2 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm">Edit Core Identity</h4>
        <Button aria-label="Collapse" variant="ghost" size="icon" onClick={onToggle}>
          <ChevronUp className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Property Name */}
        <div className="space-y-1.5">
          <Label className="text-xs">Property Name</Label>
          <Input
            value={formData.property_name}
            onChange={(e) => setFormData({ ...formData, property_name: e.target.value })}
            placeholder="Optional name"
          />
        </div>

        {/* Address Line 1 */}
        <div className="space-y-1.5">
          <Label className="text-xs">Address Line 1 *</Label>
          <Input
            value={formData.address_line}
            onChange={(e) => setFormData({ ...formData, address_line: e.target.value })}
            placeholder="Street address"
          />
        </div>

        {/* Address Line 2 */}
        <div className="space-y-1.5">
          <Label className="text-xs">Address Line 2</Label>
          <Input
            value={formData.address_line2}
            onChange={(e) => setFormData({ ...formData, address_line2: e.target.value })}
            placeholder="Apartment, suite, etc."
          />
        </div>

        {/* City/Town */}
        <div className="space-y-1.5">
          <Label className="text-xs">City/Town *</Label>
          <Input
            value={formData.town_city}
            onChange={(e) => setFormData({ ...formData, town_city: e.target.value })}
            placeholder="City or town"
          />
        </div>

        {/* County */}
        <div className="space-y-1.5">
          <Label className="text-xs">County</Label>
          <Input
            value={formData.county}
            onChange={(e) => setFormData({ ...formData, county: e.target.value })}
            placeholder="County"
          />
        </div>

        {/* Postcode */}
        <div className="space-y-1.5">
          <Label className="text-xs">Postcode *</Label>
          <Input
            value={formData.postcode}
            onChange={(e) => setFormData({ ...formData, postcode: e.target.value.toUpperCase() })}
            placeholder="SW1A 1AA"
          />
        </div>

        {/* UPRN */}
        <div className="space-y-1.5">
          <Label className="text-xs">UPRN</Label>
          <Input
            value={formData.uprn}
            onChange={(e) => setFormData({ ...formData, uprn: e.target.value })}
            placeholder="Unique Property Reference"
          />
        </div>

        {/* Planning Authority */}
        <div className="space-y-1.5">
          <Label className="text-xs">Planning Authority *</Label>
          <Input
            value={formData.planning_authority}
            onChange={(e) => setFormData({ ...formData, planning_authority: e.target.value })}
            placeholder="Local planning authority"
          />
        </div>

        {/* Property Type */}
        <div className="space-y-1.5">
          <Label className="text-xs">Property Type *</Label>
          <Select value={formData.property_type} onValueChange={(v) => setFormData({ ...formData, property_type: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {PROPERTY_TYPES.map((type) => (
                <SelectItem key={type} value={type}>{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Construction Type — from property_passport */}
        <div className="space-y-1.5">
          <Label className="text-xs">Construction Type *</Label>
          <Select value={passportData.construction_type} onValueChange={(v) => setPassportData({ ...passportData, construction_type: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {CONSTRUCTION_TYPES.map((type) => (
                <SelectItem key={type} value={type}>{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Year Built — from property_passport.built_in_year */}
        <div className="space-y-1.5">
          <Label className="text-xs">Year Built</Label>
          <Input
            value={passportData.built_in_year}
            onChange={(e) => setPassportData({ ...passportData, built_in_year: e.target.value })}
            placeholder="e.g. 1920"
          />
        </div>

        {/* Listed Status */}
        <div className="space-y-1.5">
          <Label className="text-xs">Listed Status *</Label>
          <Select value={formData.listed_status} onValueChange={(v) => setFormData({ ...formData, listed_status: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {LISTED_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>{status}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Conservation Area */}
        <div className="space-y-1.5">
          <Label className="text-xs">Conservation Area</Label>
          <div className="flex items-center gap-2 h-10">
            <Switch
              checked={formData.conservation_area}
              onCheckedChange={(checked) => setFormData({ ...formData, conservation_area: checked })}
            />
            <span className="text-sm text-muted-foreground">
              {formData.conservation_area ? 'Yes' : 'No'}
            </span>
          </div>
        </div>

        {/* Electric Meter Location */}
        <div className="space-y-1.5">
          <Label className="text-xs">Electric Meter Location</Label>
          <Input
            value={passportData.electric_meter_location}
            onChange={(e) => setPassportData({ ...passportData, electric_meter_location: e.target.value })}
            placeholder="e.g. Under stairs"
          />
        </div>

        {/* Electric Meter Number */}
        <div className="space-y-1.5">
          <Label className="text-xs">Electric Meter Number</Label>
          <Input
            value={passportData.electric_meter_number}
            onChange={(e) => setPassportData({ ...passportData, electric_meter_number: e.target.value })}
            placeholder="MPAN / meter serial"
          />
        </div>

        {/* Gas Meter Location */}
        <div className="space-y-1.5">
          <Label className="text-xs">Gas Meter Location</Label>
          <Input
            value={passportData.gas_meter_location}
            onChange={(e) => setPassportData({ ...passportData, gas_meter_location: e.target.value })}
            placeholder="e.g. External box, left side"
          />
        </div>

        {/* Gas Meter Number */}
        <div className="space-y-1.5">
          <Label className="text-xs">Gas Meter Number</Label>
          <Input
            value={passportData.gas_meter_number}
            onChange={(e) => setPassportData({ ...passportData, gas_meter_number: e.target.value })}
            placeholder="MPRN / meter serial"
          />
        </div>

        {/* Title Numbers */}
        <div className="space-y-1.5 md:col-span-2">
          <Label className="text-xs">Title Numbers</Label>
          <div className="flex flex-wrap gap-2 mb-2">
            {titleNumbers.map((tn) => (
              <Badge key={tn.id} variant="secondary" className="gap-1 pr-1">
                {tn.title_number}
                <button
                  onClick={() => handleRemoveTitleNumber(tn.id)}
                  className="ml-1 rounded-full hover:bg-muted p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={newTitleNumber}
              onChange={(e) => setNewTitleNumber(e.target.value.toUpperCase())}
              placeholder="Add title number"
              className="max-w-xs"
              onKeyDown={(e) => e.key === 'Enter' && handleAddTitleNumber()}
            />
            <Button variant="outline" size="sm" onClick={handleAddTitleNumber} disabled={!newTitleNumber.trim()}>
              Add
            </Button>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end gap-2 pt-2 border-t border-border">
        <Button variant="ghost" onClick={onToggle}>Cancel</Button>
        <Button onClick={handleSave} disabled={isSaving}>
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
