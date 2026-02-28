import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { WizardPayload } from '@/lib/wizard/types';

interface StepProps {
  payload: WizardPayload;
  updatePayload: (partial: Partial<WizardPayload>) => void;
}

const RATE_TYPES = ['fixed', 'variable', 'tracker', 'discount'];
const FACILITY_TYPES = ['buy_to_let', 'commercial', 'bridging', 'development', 'hmo', 'portfolio'];

export function StepFinance({ payload, updatePayload }: StepProps) {
  const hasMortgage = !!payload.has_mortgage;

  return (
    <div className="space-y-5">
      <div>
        <Label htmlFor="current_valuation">Current valuation (£)</Label>
        <Input
          id="current_valuation"
          type="number"
          value={(payload.current_valuation as number) || ''}
          onChange={(e) => updatePayload({ current_valuation: e.target.value ? Number(e.target.value) : undefined })}
          placeholder="350000"
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border p-4">
        <div>
          <Label htmlFor="has_mortgage">Has mortgage?</Label>
          <p className="text-xs text-muted-foreground">Toggle to enter loan details</p>
        </div>
        <Switch
          id="has_mortgage"
          checked={hasMortgage}
          onCheckedChange={(v) => updatePayload({ has_mortgage: v })}
        />
      </div>

      {hasMortgage && (
        <div className="space-y-4 pl-4 border-l-2 border-primary/20">
          <div>
            <Label htmlFor="lender_name">Lender *</Label>
            <Input
              id="lender_name"
              value={(payload.lender_name as string) || ''}
              onChange={(e) => updatePayload({ lender_name: e.target.value })}
              placeholder="Barclays"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="original_amount">Original amount (£) *</Label>
              <Input
                id="original_amount"
                type="number"
                value={(payload.original_amount as number) || ''}
                onChange={(e) => updatePayload({ original_amount: e.target.value ? Number(e.target.value) : undefined })}
              />
            </div>
            <div>
              <Label htmlFor="current_balance">Current balance (£)</Label>
              <Input
                id="current_balance"
                type="number"
                value={(payload.current_balance as number) || ''}
                onChange={(e) => updatePayload({ current_balance: e.target.value ? Number(e.target.value) : undefined })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="interest_rate">Interest rate (%) *</Label>
              <Input
                id="interest_rate"
                type="number"
                step="0.01"
                value={(payload.interest_rate as number) || ''}
                onChange={(e) => updatePayload({ interest_rate: e.target.value ? Number(e.target.value) : undefined })}
              />
            </div>
            <div>
              <Label>Rate type</Label>
              <Select
                value={(payload.rate_type as string) || ''}
                onValueChange={(v) => updatePayload({ rate_type: v })}
              >
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {RATE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Facility type</Label>
              <Select
                value={(payload.facility_type as string) || ''}
                onValueChange={(v) => updatePayload({ facility_type: v })}
              >
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {FACILITY_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t.replace(/_/g, ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="rate_expiry_date">Rate expiry date</Label>
              <Input
                id="rate_expiry_date"
                type="date"
                value={(payload.rate_expiry_date as string) || ''}
                onChange={(e) => updatePayload({ rate_expiry_date: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="monthly_payment">Monthly payment (£)</Label>
            <Input
              id="monthly_payment"
              type="number"
              value={(payload.monthly_payment as number) || ''}
              onChange={(e) => updatePayload({ monthly_payment: e.target.value ? Number(e.target.value) : undefined })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
