import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Info } from 'lucide-react';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { WizardData } from './types';

interface Props {
  data: WizardData;
  onChange: (partial: Partial<WizardData>) => void;
}

const UK_POSTCODE_REGEX = /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i;
const COUNTRIES = ['England', 'Wales', 'Scotland', 'Northern Ireland'];

export function StepAddress({ data, onChange }: Props) {
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocoded, setGeocoded] = useState(false);

  const handlePostcodeBlur = async () => {
    if (!data.postcode || !UK_POSTCODE_REGEX.test(data.postcode)) return;
    setIsGeocoding(true);
    try {
      const { data: result } = await supabase.functions.invoke('property-autofill', {
        body: { postcode: data.postcode, address_line_1: data.address_line_1 },
      });
      if (result?.fields) {
        const f = result.fields;
        const updates: Partial<WizardData> = {};
        if (f.city && !data.city) updates.city = f.city;
        if (f.county && !data.county) updates.county = f.county;
        if (Object.keys(updates).length > 0) onChange(updates);
        setGeocoded(true);
      }
    } catch {
      // silently fail geocoding
    } finally {
      setIsGeocoding(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Label className="text-base font-semibold">Postcode *</Label>
        <div className="relative mt-1.5">
          <Input
            value={data.postcode}
            onChange={e => onChange({ postcode: e.target.value.toUpperCase() })}
            onBlur={handlePostcodeBlur}
            onKeyDown={e => e.key === 'Enter' && handlePostcodeBlur()}
            placeholder="e.g. GL50 1HN"
            className="text-lg font-mono"
          />
          {isGeocoding && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      </div>

      {geocoded && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
          <Info className="h-4 w-4 shrink-0" />
          We'll auto-check EPC data and Land Registry records for this address after creation.
        </div>
      )}

      <div className="space-y-3">
        <div>
          <Label>Address Line 1 *</Label>
          <Input value={data.address_line_1} onChange={e => onChange({ address_line_1: e.target.value })} placeholder="e.g. 14 High Street" />
        </div>
        <div>
          <Label>Address Line 2</Label>
          <Input value={data.address_line_2} onChange={e => onChange({ address_line_2: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>City *</Label>
            <Input value={data.city} onChange={e => onChange({ city: e.target.value })} />
          </div>
          <div>
            <Label>County</Label>
            <Input value={data.county} onChange={e => onChange({ county: e.target.value })} />
          </div>
        </div>
        <div>
          <Label>Country</Label>
          <Select value={data.country} onValueChange={v => onChange({ country: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
