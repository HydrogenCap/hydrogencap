import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pencil, CheckCircle, Circle } from 'lucide-react';
import { PROPERTY_TYPES, LIFECYCLE_STAGES } from '@/hooks/usePropertiesV2';
import { useLegalEntities } from '@/hooks/useLegalEntities';
import type { WizardData } from './types';

interface Props {
  data: WizardData;
  goToStep: (step: number) => void;
}

const fmtGBP = (v: number) => v > 0 ? new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0 }).format(v) : '—';
const fmtDate = (d: string) => {
  if (!d) return '—';
  try { return new Intl.DateTimeFormat('en-GB').format(new Date(d)); } catch { return d; }
};

export function StepReview({ data, goToStep }: Props) {
  const { data: entities } = useLegalEntities();
  const entity = entities?.find(e => e.id === data.entity_id);
  const typeLabel = PROPERTY_TYPES.find(t => t.value === data.property_type)?.label || data.property_type;
  const stageLabel = LIFECYCLE_STAGES.find(s => s.value === data.lifecycle_stage)?.label || data.lifecycle_stage;
  const lettableRooms = data.rooms.filter(r => r.is_lettable);
  const communalAreas = data.rooms.filter(r => !r.is_lettable);
  const totalMonthly = lettableRooms.reduce((s, r) => s + (r.target_rent_pcm || 0), 0);
  const purchasePrice = parseFloat(data.purchase_price) || 0;
  const currentValuation = parseFloat(data.current_valuation) || 0;
  const currentBalance = parseFloat(data.current_balance) || 0;
  const monthlyPayment = parseFloat(data.monthly_payment) || 0;
  const interestRate = parseFloat(data.interest_rate) || 0;
  const ltv = currentValuation > 0 && currentBalance > 0 ? (currentBalance / currentValuation * 100) : 0;
  const grossYield = currentValuation > 0 && totalMonthly > 0 ? (totalMonthly * 12 / currentValuation * 100) : 0;
  const enabledCompliance = data.compliance_items.filter(c => c.is_required);

  return (
    <div className="space-y-4">
      {/* Property */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold text-lg">{data.address_line_1 || 'No address'}</p>
              <p className="text-sm text-muted-foreground">{[data.city, data.county, data.postcode].filter(Boolean).join(', ')}</p>
              <div className="mt-2 space-y-1 text-sm">
                <p>Entity: <span className="font-medium">{entity?.entity_name || '—'}</span> {entity && <span className="text-muted-foreground">({entity.entity_type})</span>}</p>
                <p>Type: <span className="font-medium">{typeLabel}</span> • Stage: <span className="font-medium">{stageLabel}</span></p>
                <p>Gas Supply: {data.has_gas_supply ? 'Yes' : 'No'} {data.year_built && `• Year Built: ${data.year_built}`} {data.total_floors && `• ${data.total_floors} Floors`}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => goToStep(0)}><Pencil className="h-3.5 w-3.5 mr-1" /> Edit</Button>
          </div>
        </CardContent>
      </Card>

      {/* Rooms */}
      {data.rooms.length > 0 && (
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold">{lettableRooms.length} Lettable Room{lettableRooms.length !== 1 ? 's' : ''} {communalAreas.length > 0 && `+ ${communalAreas.length} Communal`}</p>
                <div className="mt-2 space-y-0.5 text-sm">
                  {lettableRooms.map((r, i) => (
                    <p key={i} className="text-muted-foreground">{r.room_name} ({r.room_type}) — {r.target_rent_pcm ? fmtGBP(r.target_rent_pcm) + '/mo' : 'No rent set'}</p>
                  ))}
                </div>
                {totalMonthly > 0 && (
                  <p className="mt-2 text-sm font-medium">Monthly: {fmtGBP(totalMonthly)} • Annual: {fmtGBP(totalMonthly * 12)}</p>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={() => goToStep(2)}><Pencil className="h-3.5 w-3.5 mr-1" /> Edit</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Financials */}
      {(purchasePrice > 0 || currentValuation > 0 || data.has_mortgage) && (
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-start justify-between">
              <div className="space-y-1 text-sm">
                {purchasePrice > 0 && <p>Purchase: <span className="font-medium">{fmtGBP(purchasePrice)}</span> {data.purchase_date && `(${fmtDate(data.purchase_date)})`}</p>}
                {currentValuation > 0 && <p>Valuation: <span className="font-medium">{fmtGBP(currentValuation)}</span> {ltv > 0 && `• Equity: ${fmtGBP(currentValuation - currentBalance)}`}</p>}
                {data.has_mortgage && data.lender_name && (
                  <p>Mortgage: <span className="font-medium">{data.lender_name}</span> @ {interestRate}% {data.rate_type} {ltv > 0 && `• LTV: ${ltv.toFixed(1)}%`}</p>
                )}
                {monthlyPayment > 0 && <p>Monthly: {fmtGBP(monthlyPayment)} • Annual: {fmtGBP(monthlyPayment * 12)}</p>}
                {grossYield > 0 && <p>Gross Yield: <span className="font-medium">{grossYield.toFixed(1)}%</span></p>}
              </div>
              <Button variant="ghost" size="sm" onClick={() => goToStep(3)}><Pencil className="h-3.5 w-3.5 mr-1" /> Edit</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Compliance */}
      {enabledCompliance.length > 0 && (
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold">{enabledCompliance.length} Compliance Requirement{enabledCompliance.length !== 1 ? 's' : ''}</p>
                <div className="mt-2 space-y-0.5 text-sm">
                  {enabledCompliance.map(c => (
                    <div key={c.document_type} className="flex items-center gap-2">
                      {c.expiry_date ? <CheckCircle className="h-3.5 w-3.5 text-emerald-500" /> : <Circle className="h-3.5 w-3.5 text-muted-foreground" />}
                      <span>{c.display_name}</span>
                      {c.expiry_date && <span className="text-muted-foreground">— valid until {fmtDate(c.expiry_date)}</span>}
                      {!c.expiry_date && <span className="text-muted-foreground italic">— not yet recorded</span>}
                    </div>
                  ))}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => goToStep(4)}><Pencil className="h-3.5 w-3.5 mr-1" /> Edit</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
