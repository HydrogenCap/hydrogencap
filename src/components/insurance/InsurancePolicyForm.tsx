import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrg } from '@/hooks/useUserOrg';
import { useQuery } from '@tanstack/react-query';
import {
  TRACKER_POLICY_TYPES,
  type InsuranceTrackerPolicy,
} from '@/hooks/useInsuranceTracker';
import { InsuranceDocScanner } from './InsuranceDocScanner';
import type { ExtractedInsuranceFields } from '@/hooks/useInsuranceDocScan';

interface PropertyOption {
  id: string;
  address_line: string;
  postcode: string;
}

function usePropertyOptions() {
  const { data: orgId } = useUserOrg();
  return useQuery({
    queryKey: ['property-options', orgId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('properties')
        .select('id, address_line, postcode')
        .eq('org_id', orgId!)
        .order('address_line');
      if (error) throw error;
      return data as PropertyOption[];
    },
    enabled: !!orgId,
  });
}

interface InsurancePolicyFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  policy?: InsuranceTrackerPolicy | null;
  onSubmit: (data: Record<string, unknown>) => void;
  isSubmitting?: boolean;
}

export function InsurancePolicyForm({
  open,
  onOpenChange,
  policy,
  onSubmit,
  isSubmitting,
}: InsurancePolicyFormProps) {
  const { data: properties } = usePropertyOptions();
  const isEditing = !!policy;

  const [form, setForm] = useState({
    property_id: '',
    policy_type: '',
    insurer_name: '',
    policy_number: '',
    premium_annual: '',
    premium_frequency: 'annual',
    excess_amount: '',
    cover_amount: '',
    start_date: '',
    end_date: '',
    auto_renew: false,
    document_url: '',
    notes: '',
  });

  useEffect(() => {
    if (policy) {
      setForm({
        property_id: policy.property_id || '',
        policy_type: policy.policy_type || '',
        insurer_name: policy.insurer_name || '',
        policy_number: policy.policy_number || '',
        premium_annual: policy.premium_annual?.toString() || '',
        premium_frequency: policy.premium_frequency || 'annual',
        excess_amount: policy.excess_amount?.toString() || '',
        cover_amount: policy.cover_amount?.toString() || '',
        start_date: policy.start_date || '',
        end_date: policy.end_date || '',
        auto_renew: policy.auto_renew || false,
        document_url: policy.document_url || '',
        notes: policy.notes || '',
      });
    } else {
      setForm({
        property_id: '',
        policy_type: '',
        insurer_name: '',
        policy_number: '',
        premium_annual: '',
        premium_frequency: 'annual',
        excess_amount: '',
        cover_amount: '',
        start_date: '',
        end_date: '',
        auto_renew: false,
        document_url: '',
        notes: '',
      });
    }
  }, [policy, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      property_id: form.property_id,
      policy_type: form.policy_type || null,
      insurer_name: form.insurer_name || null,
      policy_number: form.policy_number || null,
      premium_annual: form.premium_annual ? Number(form.premium_annual) : null,
      premium_frequency: form.premium_frequency,
      excess_amount: form.excess_amount ? Number(form.excess_amount) : null,
      cover_amount: form.cover_amount ? Number(form.cover_amount) : null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      auto_renew: form.auto_renew,
      document_url: form.document_url || null,
      notes: form.notes || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Policy' : 'Add Insurance Policy'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Update the policy details below.' : 'Enter the details for the new insurance policy.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* AI document scanner — only shown when adding a new policy */}
          {!isEditing && (
            <>
              <InsuranceDocScanner
                properties={(properties ?? []).map(p => ({
                  id: p.id,
                  address_line: p.address_line,
                  postcode: p.postcode,
                }))}
                onExtracted={(fields: ExtractedInsuranceFields) =>
                  setForm(f => ({
                    ...f,
                    ...(fields.insurer_name ? { insurer_name: fields.insurer_name } : {}),
                    ...(fields.policy_number ? { policy_number: fields.policy_number } : {}),
                    ...(fields.policy_type ? { policy_type: fields.policy_type } : {}),
                    ...(fields.start_date ? { start_date: fields.start_date } : {}),
                    ...(fields.end_date ? { end_date: fields.end_date } : {}),
                  }))
                }
              />
              <Separator />
            </>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="property_id">Property</Label>
              <Select
                value={form.property_id}
                onValueChange={(v) => setForm(f => ({ ...f, property_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select property..." />
                </SelectTrigger>
                <SelectContent>
                  {properties?.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.address_line}, {p.postcode}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="policy_type">Policy Type</Label>
              <Select
                value={form.policy_type}
                onValueChange={(v) => setForm(f => ({ ...f, policy_type: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent>
                  {TRACKER_POLICY_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="insurer_name">Insurer</Label>
              <Input
                id="insurer_name"
                value={form.insurer_name}
                onChange={(e) => setForm(f => ({ ...f, insurer_name: e.target.value }))}
                placeholder="e.g. Aviva, AXA..."
              />
            </div>

            <div>
              <Label htmlFor="policy_number">Policy Number</Label>
              <Input
                id="policy_number"
                value={form.policy_number}
                onChange={(e) => setForm(f => ({ ...f, policy_number: e.target.value }))}
                placeholder="Policy reference"
              />
            </div>

            <div>
              <Label htmlFor="premium_annual">Annual Premium (&pound;)</Label>
              <Input
                id="premium_annual"
                type="number"
                step="0.01"
                value={form.premium_annual}
                onChange={(e) => setForm(f => ({ ...f, premium_annual: e.target.value }))}
                placeholder="0.00"
              />
            </div>

            <div>
              <Label htmlFor="premium_frequency">Payment Frequency</Label>
              <Select
                value={form.premium_frequency}
                onValueChange={(v) => setForm(f => ({ ...f, premium_frequency: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="annual">Annual</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="excess_amount">Excess (&pound;)</Label>
              <Input
                id="excess_amount"
                type="number"
                step="0.01"
                value={form.excess_amount}
                onChange={(e) => setForm(f => ({ ...f, excess_amount: e.target.value }))}
                placeholder="0.00"
              />
            </div>

            <div>
              <Label htmlFor="cover_amount">Cover Amount (&pound;)</Label>
              <Input
                id="cover_amount"
                type="number"
                step="0.01"
                value={form.cover_amount}
                onChange={(e) => setForm(f => ({ ...f, cover_amount: e.target.value }))}
                placeholder="0.00"
              />
            </div>

            <div>
              <Label htmlFor="start_date">Start Date</Label>
              <Input
                id="start_date"
                type="date"
                value={form.start_date}
                onChange={(e) => setForm(f => ({ ...f, start_date: e.target.value }))}
              />
            </div>

            <div>
              <Label htmlFor="end_date">End Date</Label>
              <Input
                id="end_date"
                type="date"
                value={form.end_date}
                onChange={(e) => setForm(f => ({ ...f, end_date: e.target.value }))}
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="document_url">Document URL</Label>
              <Input
                id="document_url"
                value={form.document_url}
                onChange={(e) => setForm(f => ({ ...f, document_url: e.target.value }))}
                placeholder="Link to policy document"
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Additional notes..."
                rows={3}
              />
            </div>

            <div className="col-span-2 flex items-center space-x-2">
              <Checkbox
                id="auto_renew"
                checked={form.auto_renew}
                onCheckedChange={(checked) =>
                  setForm(f => ({ ...f, auto_renew: checked === true }))
                }
              />
              <Label htmlFor="auto_renew" className="text-sm font-normal">
                Auto-renew policy
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!form.property_id || isSubmitting}>
              {isSubmitting ? 'Saving...' : isEditing ? 'Update Policy' : 'Add Policy'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
