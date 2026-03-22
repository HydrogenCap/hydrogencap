import { useEffect, useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { addMonths, format } from 'date-fns';
import { DOC_TYPE_DISPLAY_NAMES, type ComplianceDocType } from '@/lib/complianceV2Types';
import type { WizardData, ComplianceReq } from './types';
import { COMPLIANCE_VALIDITY_MONTHS } from './types';

interface Props {
  data: WizardData;
  onChange: (partial: Partial<WizardData>) => void;
}

// Which items apply to which property types
const BASE_ITEMS: ComplianceDocType[] = ['gas_safety_certificate', 'epc', 'eicr', 'buildings_insurance'];
const HMO_ITEMS: ComplianceDocType[] = ['fire_risk_assessment', 'hmo_licence', 'emergency_lighting_cert', 'fire_alarm_cert', 'smoke_co_alarm_cert', 'furniture_fire_safety'];
const OPTIONAL_ITEMS: ComplianceDocType[] = ['selective_licence'];

function buildDefaults(propertyType: string, hasGas: boolean): ComplianceReq[] {
  const isHmo = ['hmo_licensed', 'hmo_mandatory'].includes(propertyType);
  const items: ComplianceDocType[] = [...BASE_ITEMS];
  if (isHmo) items.push(...HMO_ITEMS);
  items.push(...OPTIONAL_ITEMS);

  return items.map(dt => ({
    document_type: dt,
    display_name: DOC_TYPE_DISPLAY_NAMES[dt] || dt,
    is_required: dt === 'gas_safety_certificate' ? hasGas : !OPTIONAL_ITEMS.includes(dt),
    issue_date: '',
    expiry_date: '',
    certificate_number: '',
    review_frequency_months: COMPLIANCE_VALIDITY_MONTHS[dt] || null,
    lead_time_days: 30,
  }));
}

export function StepCompliance({ data, onChange }: Props) {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!initialized && data.compliance_items.length === 0) {
      onChange({ compliance_items: buildDefaults(data.property_type, data.has_gas_supply) });
      setInitialized(true);
    }
  }, [initialized, data.compliance_items.length, data.property_type, data.has_gas_supply, onChange]);

  const items = data.compliance_items;

  const toggle = (idx: number) => {
    const updated = items.map((c, i) => i === idx ? { ...c, is_required: !c.is_required } : c);
    onChange({ compliance_items: updated });
  };

  const updateItem = (idx: number, partial: Partial<ComplianceReq>) => {
    const updated = items.map((c, i) => {
      if (i !== idx) return c;
      const merged = { ...c, ...partial };
      // Auto-calc expiry from issue date
      if (partial.issue_date && !c.expiry_date) {
        const months = COMPLIANCE_VALIDITY_MONTHS[c.document_type];
        if (months && months > 0) {
          merged.expiry_date = format(addMonths(new Date(partial.issue_date), months), 'yyyy-MM-dd');
        }
      }
      return merged;
    });
    onChange({ compliance_items: updated });
  };

  const enabledItems = items.filter(c => c.is_required);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold mb-3">Compliance Requirements</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Auto-detected based on your property type. Untick items you don't need.
        </p>

        <div className="space-y-2">
          {items.map((item, i) => {
            const isGasDisabled = item.document_type === 'gas_safety_certificate' && !data.has_gas_supply;
            return (
              <div key={item.document_type} className="flex items-center gap-3 py-1">
                <Checkbox
                  checked={item.is_required && !isGasDisabled}
                  onCheckedChange={() => toggle(i)}
                  disabled={isGasDisabled}
                />
                <span className={`text-sm ${isGasDisabled ? 'text-muted-foreground line-through' : ''}`}>
                  {item.display_name}
                </span>
                {isGasDisabled && (
                  <span className="text-xs text-muted-foreground italic">Not required (no gas supply)</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Date entry for enabled items */}
      {enabledItems.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3">Already have certificates?</h3>
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead className="w-36">Issue Date</TableHead>
                  <TableHead className="w-36">Expiry Date</TableHead>
                  <TableHead className="w-32">Certificate #</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, i) => {
                  if (!item.is_required) return null;
                  return (
                    <TableRow key={item.document_type}>
                      <TableCell className="text-sm">{item.display_name}</TableCell>
                      <TableCell>
                        <Input type="date" value={item.issue_date} onChange={e => updateItem(i, { issue_date: e.target.value })} className="h-8 text-sm" />
                      </TableCell>
                      <TableCell>
                        <Input type="date" value={item.expiry_date} onChange={e => updateItem(i, { expiry_date: e.target.value })} className="h-8 text-sm" />
                      </TableCell>
                      <TableCell>
                        <Input value={item.certificate_number} onChange={e => updateItem(i, { certificate_number: e.target.value })} className="h-8 text-sm" placeholder="Optional" />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center">All fields on this step are optional — you can add certificates later</p>
    </div>
  );
}
