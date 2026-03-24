import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2 } from 'lucide-react';
import { useCreatePropertyV2, useUpdatePropertyV2, PROPERTY_TYPES, LIFECYCLE_STAGES, LISTING_GRADES } from '@/hooks/usePropertiesV2';
import { useLegalEntities } from '@/hooks/useLegalEntities';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { PropertyWithEntity } from '@/hooks/usePropertiesV2';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingProperty?: PropertyWithEntity | null;
}

const ENTITY_TYPE_COLORS: Record<string, string> = {
  spv: 'text-blue-600', personal: 'text-emerald-600',
  joint_venture: 'text-purple-600', trust: 'text-amber-600',
};

const initialForm = {
  entity_id: '',
  address_line_1: '',
  address_line_2: '',
  city: '',
  county: '',
  postcode: '',
  country: 'England',
  property_type: 'single_let',
  lifecycle_stage: 'pipeline',
  council_name: '',
  council_area: '',
  listing_grade: 'none',
  rent_basis: 'room' as 'room' | 'whole_house',
  whole_house_rent_pcm: '',
  has_gas_supply: true,
  year_built: '',
  total_floors: '',
  total_lettable_rooms: '0',
  purchase_date: '',
  purchase_price: '',
  current_valuation: '',
  valuation_date: '',
  notes: '',
};

type PropertyFormState = typeof initialForm;
type PropertyAutoFillValue = string | number | boolean | null;
type PropertyAutoFillResponse = {
  error?: string;
  fields?: Partial<Record<keyof PropertyFormState, PropertyAutoFillValue>>;
  sources?: Partial<Record<keyof PropertyFormState, string>>;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown error';
}

export function PropertyFormModal({ open, onOpenChange, editingProperty }: Props) {
  const create = useCreatePropertyV2();
  const update = useUpdatePropertyV2();
  const { data: entities } = useLegalEntities();
  const { toast } = useToast();
  const [isAutoFilling, setIsAutoFilling] = useState(false);
  const [autoFilledFields, setAutoFilledFields] = useState<Partial<Record<keyof PropertyFormState, string>>>({});
  const [form, setForm] = useState<PropertyFormState>(initialForm);

  const handleAutoFill = async () => {
    if (!form.postcode || form.postcode.length < 5) {
      toast({ title: 'Enter a postcode first', variant: 'destructive' });
      return;
    }
    setIsAutoFilling(true);
    setAutoFilledFields({});
    try {
      const { data, error } = await supabase.functions.invoke<PropertyAutoFillResponse>('property-autofill', {
        body: { postcode: form.postcode, address_line_1: form.address_line_1 },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const fields = data?.fields ?? {};
      const sources = data?.sources ?? {};

      // Merge into form, only overwriting empty/default fields
      setForm(prev => {
        const updated: PropertyFormState = { ...prev };
        const fieldsToSet: Partial<Record<keyof PropertyFormState, string>> = {};

        for (const [key, value] of Object.entries(fields) as [keyof PropertyFormState, PropertyAutoFillValue][]) {
          const currentVal = prev[key];
          const isEmpty = currentVal === '' || currentVal === null || currentVal === undefined
            || currentVal === 'none' || currentVal === 'pipeline' || currentVal === '0';
          const hasValue = typeof value === 'boolean' ? true : value !== '' && value !== null && value !== undefined;
          if (isEmpty && hasValue) {
            updated[key] = value as PropertyFormState[typeof key];
            fieldsToSet[key] = sources[key] || 'AI';
          }
        }
        setAutoFilledFields(fieldsToSet);
        return updated;
      });

      const count = Object.keys(fields).length;
      toast({
        title: count > 0 ? `Auto-filled ${count} fields` : 'No additional data found',
        description: count > 0 ? Object.entries(sources).map(([k, v]) => `${k}: ${v}`).join(', ') : 'Try adding more address details.',
      });
    } catch (error: unknown) {
      console.error('Auto-fill error:', error);
      toast({ title: 'Auto-fill failed', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setIsAutoFilling(false);
    }
  };

  useEffect(() => {
    if (editingProperty) {
      setForm({
        entity_id: editingProperty.entity_id,
        address_line_1: editingProperty.address_line_1,
        address_line_2: editingProperty.address_line_2 || '',
        city: editingProperty.city,
        county: editingProperty.county || '',
        postcode: editingProperty.postcode,
        country: editingProperty.country || 'England',
        property_type: editingProperty.property_type,
        lifecycle_stage: editingProperty.lifecycle_stage,
        council_name: editingProperty.council_name || '',
        council_area: editingProperty.council_area || '',
        listing_grade: editingProperty.listing_grade,
        rent_basis: editingProperty.rent_basis || 'room',
        whole_house_rent_pcm: editingProperty.whole_house_rent_pcm?.toString() || '',
        has_gas_supply: editingProperty.has_gas_supply ?? true,
        year_built: editingProperty.year_built?.toString() || '',
        total_floors: editingProperty.total_floors?.toString() || '',
        total_lettable_rooms: editingProperty.total_lettable_rooms?.toString() || '0',
        purchase_date: editingProperty.purchase_date || '',
        purchase_price: editingProperty.purchase_price?.toString() || '',
        current_valuation: editingProperty.current_valuation?.toString() || '',
        valuation_date: editingProperty.valuation_date || '',
        notes: editingProperty.notes || '',
      });
    } else {
      setForm(initialForm);
    }
  }, [editingProperty, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.entity_id || !form.address_line_1 || !form.city || !form.postcode) {
      toast({ title: 'Missing required fields', variant: 'destructive' });
      return;
    }
    const payload = {
      entity_id: form.entity_id,
      address_line_1: form.address_line_1,
      address_line_2: form.address_line_2 || null,
      city: form.city,
      county: form.county || null,
      postcode: form.postcode,
      country: form.country || 'England',
      property_type: form.property_type,
      lifecycle_stage: form.lifecycle_stage,
      council_name: form.council_name || null,
      council_area: form.council_area || null,
      listing_grade: form.listing_grade,
      rent_basis: form.rent_basis,
      whole_house_rent_pcm: form.rent_basis === 'whole_house' && form.whole_house_rent_pcm ? parseFloat(form.whole_house_rent_pcm) : null,
      has_gas_supply: form.has_gas_supply,
      year_built: form.year_built ? parseInt(form.year_built) : null,
      total_floors: form.total_floors ? parseInt(form.total_floors) : null,
      total_lettable_rooms: form.total_lettable_rooms ? parseInt(form.total_lettable_rooms) : 0,
      purchase_date: form.purchase_date || null,
      purchase_price: form.purchase_price ? parseFloat(form.purchase_price) : null,
      current_valuation: form.current_valuation ? parseFloat(form.current_valuation) : null,
      valuation_date: form.valuation_date || null,
      notes: form.notes || null,
      latitude: null,
      longitude: null,
    };
    try {
      if (editingProperty) {
        await update.mutateAsync({ id: editingProperty.id, ...payload });
        toast({ title: 'Property updated' });
      } else {
        await create.mutateAsync(payload);
        toast({ title: 'Property created' });
      }
      onOpenChange(false);
    } catch (error: unknown) {
      toast({ title: 'Error', description: getErrorMessage(error), variant: 'destructive' });
    }
  };

  const set = <K extends keyof PropertyFormState>(key: K, value: PropertyFormState[K]) =>
    setForm(f => ({ ...f, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{editingProperty ? 'Edit Property' : 'Add Property'}</DialogTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAutoFill}
              disabled={isAutoFilling || !form.postcode || form.postcode.length < 5}
              className="gap-2"
            >
              {isAutoFilling ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Auto-filling...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  AI Auto-fill
                </>
              )}
            </Button>
          </div>
          {Object.keys(autoFilledFields).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {Object.entries(autoFilledFields).map(([field, source]) => (
                <Badge key={field} variant="secondary" className="text-xs">
                  {field.replace(/_/g, ' ')} • {source}
                </Badge>
              ))}
            </div>
          )}
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Address */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Address</h3>
            <div className="grid grid-cols-1 gap-3">
              <div><Label>Address Line 1 *</Label><Input value={form.address_line_1} onChange={e => set('address_line_1', e.target.value)} required /></div>
              <div><Label>Address Line 2</Label><Input value={form.address_line_2} onChange={e => set('address_line_2', e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>City *</Label><Input value={form.city} onChange={e => set('city', e.target.value)} required /></div>
                <div><Label>County</Label><Input value={form.county} onChange={e => set('county', e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Postcode *</Label><Input value={form.postcode} onChange={e => set('postcode', e.target.value)} required /></div>
                <div><Label>Country</Label><Input value={form.country} onChange={e => set('country', e.target.value)} /></div>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Property Details</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Owning Entity *</Label>
                <Select value={form.entity_id} onValueChange={v => set('entity_id', v)}>
                  <SelectTrigger><SelectValue placeholder="Select entity" /></SelectTrigger>
                  <SelectContent>
                    {entities?.filter(e => e.status === 'active').map(e => (
                      <SelectItem key={e.id} value={e.id}>
                        <span className={ENTITY_TYPE_COLORS[e.entity_type]}>{e.entity_name}</span>
                        <span className="text-xs text-muted-foreground ml-2">({e.entity_type.replace('_', ' ')})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Property Type *</Label>
                <Select value={form.property_type} onValueChange={v => set('property_type', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PROPERTY_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Lifecycle Stage *</Label>
                <Select value={form.lifecycle_stage} onValueChange={v => set('lifecycle_stage', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LIFECYCLE_STAGES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Council Name</Label><Input value={form.council_name} onChange={e => set('council_name', e.target.value)} /></div>
              <div><Label>Council Area</Label><Input value={form.council_area} onChange={e => set('council_area', e.target.value)} /></div>
              <div>
                <Label>Listed Building Grade</Label>
                <Select value={form.listing_grade} onValueChange={v => set('listing_grade', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LISTING_GRADES.map(g => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3 pt-6">
                <Switch checked={form.has_gas_supply} onCheckedChange={v => set('has_gas_supply', v)} />
                <Label>Has Gas Supply</Label>
              </div>
              <div>
                <Label>Rent Basis</Label>
                <Select value={form.rent_basis} onValueChange={v => set('rent_basis', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="room">Per Room</SelectItem>
                    <SelectItem value="whole_house">Whole House</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.rent_basis === 'whole_house' && (
                <div><Label>Whole House Rent (£/month)</Label><Input type="number" step="0.01" value={form.whole_house_rent_pcm} onChange={e => set('whole_house_rent_pcm', e.target.value)} placeholder="e.g. 1500" /></div>
              )}
              <div><Label>Year Built</Label><Input type="number" value={form.year_built} onChange={e => set('year_built', e.target.value)} /></div>
              <div><Label>Total Floors</Label><Input type="number" value={form.total_floors} onChange={e => set('total_floors', e.target.value)} /></div>
              <div><Label>Total Lettable Rooms</Label><Input type="number" value={form.total_lettable_rooms} onChange={e => set('total_lettable_rooms', e.target.value)} /></div>
            </div>
          </div>

          {/* Financial */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Financial</h3>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Purchase Date</Label><Input type="date" value={form.purchase_date} onChange={e => set('purchase_date', e.target.value)} /></div>
              <div><Label>Purchase Price (£)</Label><Input type="number" step="0.01" value={form.purchase_price} onChange={e => set('purchase_price', e.target.value)} /></div>
              <div><Label>Current Valuation (£)</Label><Input type="number" step="0.01" value={form.current_valuation} onChange={e => set('current_valuation', e.target.value)} /></div>
              <div><Label>Valuation Date</Label><Input type="date" value={form.valuation_date} onChange={e => set('valuation_date', e.target.value)} /></div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={create.isPending || update.isPending}>
              {editingProperty ? 'Save Changes' : 'Add Property'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
