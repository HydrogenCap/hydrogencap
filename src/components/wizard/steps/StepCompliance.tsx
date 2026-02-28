import { useEffect, useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import type { WizardPayload, ComplianceItem } from '@/lib/wizard/types';

interface StepProps {
  payload: WizardPayload;
  updatePayload: (partial: Partial<WizardPayload>) => void;
}

interface Template {
  document_type: string;
  display_name: string;
  category: string;
  default_frequency_months: number | null;
  default_lead_time_days: number | null;
  applies_when: Record<string, unknown>;
}

export function StepCompliance({ payload, updatePayload }: StepProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const items = (payload.compliance_items as ComplianceItem[]) || [];

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('compliance_templates')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (data) {
        setTemplates(data as unknown as Template[]);
        // Auto-populate if empty
        if (items.length === 0 && data.length > 0) {
          const auto = (data as unknown as Template[]).map((t) => ({
            document_type: t.document_type,
            display_name: t.display_name,
            is_required: shouldBeRequired(t, payload),
            review_frequency_months: t.default_frequency_months,
            lead_time_days: t.default_lead_time_days || 30,
            reason: '',
          }));
          updatePayload({ compliance_items: auto as unknown as WizardPayload['compliance_items'] });
        }
      }
    }
    load();
  }, []);

  const updateItem = (idx: number, field: keyof ComplianceItem, value: unknown) => {
    const updated = items.map((item, i) => (i === idx ? { ...item, [field]: value } : item));
    updatePayload({ compliance_items: updated as unknown as WizardPayload['compliance_items'] });
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Toggle requirements on/off and set expiry dates. Items are pre-populated from templates.
      </p>

      {items.map((item, idx) => (
        <div key={item.document_type} className="border border-border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Switch
                checked={item.is_required}
                onCheckedChange={(v) => updateItem(idx, 'is_required', v)}
              />
              <span className="text-sm font-medium">{item.display_name}</span>
            </div>
            {item.review_frequency_months && (
              <Badge variant="secondary" className="text-xs">
                Every {item.review_frequency_months} months
              </Badge>
            )}
          </div>

          {item.is_required && (
            <div className="grid grid-cols-2 gap-3 pl-10">
              <div>
                <Label className="text-xs">Expiry date</Label>
                <Input
                  type="date"
                  value={item.expiry_date || ''}
                  onChange={(e) => updateItem(idx, 'expiry_date', e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">Contractor</Label>
                <Input
                  value={item.contractor_name || ''}
                  onChange={(e) => updateItem(idx, 'contractor_name', e.target.value)}
                  placeholder="Optional"
                />
              </div>
            </div>
          )}

          {!item.is_required && (
            <div className="pl-10">
              <Input
                value={item.override_reason || ''}
                onChange={(e) => updateItem(idx, 'override_reason', e.target.value)}
                placeholder="Reason for excluding (optional)"
                className="text-xs"
              />
            </div>
          )}
        </div>
      ))}

      {items.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8 border border-dashed border-border rounded-lg">
          Loading compliance templates…
        </p>
      )}
    </div>
  );
}

function shouldBeRequired(template: Template, payload: WizardPayload): boolean {
  const conditions = template.applies_when;
  if (!conditions || Object.keys(conditions).length === 0) return true;
  if (conditions.has_gas_supply === true && !payload.has_gas_supply) return false;
  if (conditions.property_type && conditions.property_type !== payload.property_type) return false;
  return true;
}
