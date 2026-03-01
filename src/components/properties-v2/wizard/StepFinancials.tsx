import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Landmark } from 'lucide-react';
import { useState } from 'react';
import { useLenders } from '@/hooks/useLenders';
import { FACILITY_TYPES, RATE_TYPES } from '@/hooks/useLoanFacilities';
import type { WizardData } from './types';

interface Props {
  data: WizardData;
  onChange: (partial: Partial<WizardData>) => void;
}

export function StepFinancials({ data, onChange }: Props) {
  const [mortgageOpen, setMortgageOpen] = useState(data.has_mortgage);
  const { data: lenders } = useLenders();

  const purchasePrice = parseFloat(data.purchase_price) || 0;
  const stampDuty = parseFloat(data.stamp_duty) || 0;
  const refurbCosts = parseFloat(data.refurb_costs) || 0;
  const currentValuation = parseFloat(data.current_valuation) || 0;
  const currentBalance = parseFloat(data.current_balance) || 0;
  const monthlyPayment = parseFloat(data.monthly_payment) || 0;

  const totalInvestment = purchasePrice + stampDuty + refurbCosts;
  const equity = currentValuation > 0 ? currentValuation - currentBalance : 0;
  const ltv = currentValuation > 0 && currentBalance > 0 ? (currentBalance / currentValuation * 100) : 0;
  const annualMortgage = monthlyPayment * 12;

  const fmtGBP = (v: number) => v > 0 ? new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0 }).format(v) : '—';

  return (
    <div className="space-y-6">
      {/* Purchase Details */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Purchase Details</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Purchase Date</Label>
            <Input type="date" value={data.purchase_date} onChange={e => onChange({ purchase_date: e.target.value })} />
          </div>
          <div>
            <Label>Purchase Price (£)</Label>
            <Input type="number" value={data.purchase_price} onChange={e => onChange({ purchase_price: e.target.value })} placeholder="185000" />
          </div>
          <div>
            <Label>Current Valuation (£)</Label>
            <Input type="number" value={data.current_valuation} onChange={e => {
              const updates: Partial<WizardData> = { current_valuation: e.target.value };
              if (e.target.value && !data.valuation_date) {
                updates.valuation_date = new Date().toISOString().slice(0, 10);
              }
              onChange(updates);
            }} placeholder="240000" />
          </div>
          <div>
            <Label>Valuation Date</Label>
            <Input type="date" value={data.valuation_date} onChange={e => onChange({ valuation_date: e.target.value })} />
          </div>
          <div>
            <Label>Stamp Duty Paid (£)</Label>
            <Input type="number" value={data.stamp_duty} onChange={e => onChange({ stamp_duty: e.target.value })} placeholder="Optional" />
          </div>
          <div>
            <Label>Refurb Costs (£)</Label>
            <Input type="number" value={data.refurb_costs} onChange={e => onChange({ refurb_costs: e.target.value })} placeholder="Optional" />
          </div>
        </div>

        {totalInvestment > 0 && (
          <div className="bg-muted/50 rounded-lg p-3 flex gap-6 text-sm">
            <div><span className="text-muted-foreground">Total investment:</span> <span className="font-semibold">{fmtGBP(totalInvestment)}</span></div>
            {equity > 0 && <div><span className="text-muted-foreground">Equity:</span> <span className="font-semibold">{fmtGBP(equity)}</span></div>}
          </div>
        )}
      </div>

      {/* Mortgage */}
      <Collapsible open={mortgageOpen} onOpenChange={open => { setMortgageOpen(open); onChange({ has_mortgage: open }); }}>
        <CollapsibleTrigger className="flex items-center justify-between w-full py-3 border-t">
          <div className="flex items-center gap-2">
            <Landmark className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Add mortgage details (optional)</span>
          </div>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${mortgageOpen ? 'rotate-180' : ''}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Lender</Label>
              <Input
                value={data.lender_name}
                onChange={e => onChange({ lender_name: e.target.value })}
                list="lender-list"
                placeholder="Start typing..."
              />
              <datalist id="lender-list">
                {lenders?.map(l => <option key={l.id} value={l.lender_name} />)}
              </datalist>
            </div>
            <div>
              <Label>Facility Type</Label>
              <Select value={data.facility_type} onValueChange={v => onChange({ facility_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FACILITY_TYPES.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Original Loan Amount (£)</Label>
              <Input type="number" value={data.original_amount} onChange={e => {
                const updates: Partial<WizardData> = { original_amount: e.target.value };
                if (!data.current_balance) updates.current_balance = e.target.value;
                onChange(updates);
              }} placeholder="160000" />
            </div>
            <div>
              <Label>Current Balance (£)</Label>
              <Input type="number" value={data.current_balance} onChange={e => onChange({ current_balance: e.target.value })} placeholder="160000" />
            </div>
            <div>
              <Label>Interest Rate (%)</Label>
              <Input type="number" step="0.01" value={data.interest_rate} onChange={e => onChange({ interest_rate: e.target.value })} placeholder="5.49" />
            </div>
            <div className="col-span-2">
              <Label>Rate Type</Label>
              <RadioGroup value={data.rate_type} onValueChange={v => onChange({ rate_type: v })} className="flex gap-4 mt-1.5">
                {RATE_TYPES.map(r => (
                  <div key={r.value} className="flex items-center gap-2">
                    <RadioGroupItem value={r.value} id={`rate-${r.value}`} />
                    <Label htmlFor={`rate-${r.value}`} className="font-normal cursor-pointer">{r.label}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
            {data.rate_type === 'fixed' && (
              <div>
                <Label>Rate Expiry Date</Label>
                <Input type="date" value={data.rate_expiry_date} onChange={e => onChange({ rate_expiry_date: e.target.value })} />
              </div>
            )}
            <div>
              <Label>Monthly Payment (£)</Label>
              <Input type="number" value={data.monthly_payment} onChange={e => onChange({ monthly_payment: e.target.value })} placeholder="732" />
            </div>
            <div>
              <Label>Term End Date</Label>
              <Input type="date" value={data.term_end_date} onChange={e => onChange({ term_end_date: e.target.value })} />
            </div>
            <div>
              <Label>LTV Covenant (%)</Label>
              <Input type="number" value={data.ltv_covenant} onChange={e => onChange({ ltv_covenant: e.target.value })} placeholder="Optional" />
            </div>
          </div>

          {(ltv > 0 || annualMortgage > 0) && (
            <div className="bg-muted/50 rounded-lg p-3 flex gap-6 text-sm">
              {ltv > 0 && <div><span className="text-muted-foreground">LTV:</span> <span className="font-semibold">{ltv.toFixed(1)}%</span></div>}
              {annualMortgage > 0 && <div><span className="text-muted-foreground">Annual mortgage:</span> <span className="font-semibold">{fmtGBP(annualMortgage)}</span></div>}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      <p className="text-xs text-muted-foreground text-center">All fields on this step are optional — skip for now if needed</p>
    </div>
  );
}
