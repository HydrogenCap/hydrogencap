import { useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { fetchUserOrgId } from '@/hooks/useUserOrg';
import type { WizardPayload } from '@/lib/wizard/types';

interface StepProps {
  payload: WizardPayload;
  updatePayload: (partial: Partial<WizardPayload>) => void;
}

interface Entity {
  id: string;
  entity_name: string;
  entity_type: string;
}

const LISTING_GRADES = [
  { value: 'none', label: 'Not Listed' },
  { value: 'grade_i', label: 'Grade I' },
  { value: 'grade_ii', label: 'Grade II' },
  { value: 'grade_ii_star', label: 'Grade II*' },
];

export function StepOwnership({ payload, updatePayload }: StepProps) {
  const [entities, setEntities] = useState<Entity[]>([]);

  useEffect(() => {
    async function load() {
      const orgId = await fetchUserOrgId();
      const { data } = await supabase
        .from('legal_entities')
        .select('id, entity_name, entity_type')
        .eq('org_id', orgId)
        .order('entity_name');
      if (data) setEntities(data);
    }
    load();
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <Label>Owning entity *</Label>
        <Select
          value={(payload.entity_id as string) || ''}
          onValueChange={(v) => updatePayload({ entity_id: v })}
        >
          <SelectTrigger><SelectValue placeholder="Select entity" /></SelectTrigger>
          <SelectContent>
            {entities.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.entity_name} ({e.entity_type})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground mt-1">
          Don't see the right entity? Create one using the Add Entity wizard first.
        </p>
      </div>

      <div>
        <Label>Listing grade</Label>
        <Select
          value={(payload.listing_grade as string) || 'none'}
          onValueChange={(v) => updatePayload({ listing_grade: v })}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {LISTING_GRADES.map((g) => (
              <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="purchase_date">Purchase date</Label>
          <Input
            id="purchase_date"
            type="date"
            value={(payload.purchase_date as string) || ''}
            onChange={(e) => updatePayload({ purchase_date: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="purchase_price">Purchase price (£)</Label>
          <Input
            id="purchase_price"
            type="number"
            value={(payload.purchase_price as number) || ''}
            onChange={(e) => updatePayload({ purchase_price: e.target.value ? Number(e.target.value) : undefined })}
            placeholder="250000"
          />
        </div>
      </div>
    </div>
  );
}
