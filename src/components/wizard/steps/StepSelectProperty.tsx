import { useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabaseAny } from '@/integrations/supabase/client';
import { fetchUserOrgId } from '@/hooks/useUserOrg';
import type { WizardPayload } from '@/lib/wizard/types';

interface StepProps {
  payload: WizardPayload;
  updatePayload: (partial: Partial<WizardPayload>) => void;
}

interface Property {
  id: string;
  address_line_1: string;
  postcode: string;
}

export function StepSelectProperty({ payload, updatePayload }: StepProps) {
  const [properties, setProperties] = useState<Property[]>([]);

  useEffect(() => {
    async function load() {
      const orgId = await fetchUserOrgId();
      const { data } = await supabaseAny
        .from('properties_v2')
        .select('id, address_line_1, postcode')
        .eq('org_id', orgId)
        .order('address_line_1');
      if (data) setProperties(data);
    }
    load();
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <Label>Property *</Label>
        <Select
          value={(payload.property_id as string) || ''}
          onValueChange={(v) => {
            const prop = properties.find((p) => p.id === v);
            updatePayload({
              property_id: v,
              _property_address: prop ? `${prop.address_line_1}, ${prop.postcode}` : '',
              room_id: null,
              _room_name: undefined,
            });
          }}
        >
          <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
          <SelectContent>
            {properties.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.address_line_1}, {p.postcode}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
