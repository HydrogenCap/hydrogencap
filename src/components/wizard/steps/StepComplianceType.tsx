import { useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabaseAny } from '@/integrations/supabase/client';
import type { WizardPayload } from '@/lib/wizard/types';

interface StepProps {
  payload: WizardPayload;
  updatePayload: (partial: Partial<WizardPayload>) => void;
}

interface Template {
  document_type: string;
  display_name: string;
}

export function StepComplianceType({ payload, updatePayload }: StepProps) {
  const [templates, setTemplates] = useState<Template[]>([]);

  useEffect(() => {
    async function load() {
      const { data } = await supabaseAny
        .from('compliance_templates')
        .select('document_type, display_name')
        .eq('is_active', true)
        .order('sort_order');
      if (data) setTemplates(data);
    }
    load();
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <Label>Document type *</Label>
        <Select
          value={(payload.document_type as string) || ''}
          onValueChange={(v) => {
            const tpl = templates.find((t) => t.document_type === v);
            updatePayload({
              document_type: v,
              _document_display_name: tpl?.display_name || v,
            });
          }}
        >
          <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
          <SelectContent>
            {templates.map((t) => (
              <SelectItem key={t.document_type} value={t.document_type}>
                {t.display_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="issue_date">Issue date *</Label>
          <Input
            id="issue_date"
            type="date"
            value={(payload.issue_date as string) || ''}
            onChange={(e) => updatePayload({ issue_date: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="expiry_date">Expiry date</Label>
          <Input
            id="expiry_date"
            type="date"
            value={(payload.expiry_date as string) || ''}
            onChange={(e) => updatePayload({ expiry_date: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="issuer_name">Issuer / contractor</Label>
          <Input
            id="issuer_name"
            value={(payload.issuer_name as string) || ''}
            onChange={(e) => updatePayload({ issuer_name: e.target.value })}
            placeholder="Gas Safe Engineer Ltd"
          />
        </div>
        <div>
          <Label htmlFor="certificate_number">Certificate number</Label>
          <Input
            id="certificate_number"
            value={(payload.certificate_number as string) || ''}
            onChange={(e) => updatePayload({ certificate_number: e.target.value })}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="cost">Cost (£)</Label>
        <Input
          id="cost"
          type="number"
          value={(payload.cost as number) || ''}
          onChange={(e) => updatePayload({ cost: e.target.value ? Number(e.target.value) : undefined })}
        />
      </div>

      <div>
        <Label htmlFor="compliance_notes">Notes</Label>
        <Textarea
          id="compliance_notes"
          value={(payload.compliance_notes as string) || ''}
          onChange={(e) => updatePayload({ compliance_notes: e.target.value })}
          rows={2}
        />
      </div>
    </div>
  );
}
