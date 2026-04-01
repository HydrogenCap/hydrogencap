import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { LenderSelector } from './LenderSelector';
import { useCreateLoanFacility, useUpdateLoanFacility, FACILITY_TYPES, RATE_TYPES, REPAYMENT_TYPES, type LoanFacilityWithDetails } from '@/hooks/useLoanFacilities';
import { useToast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId?: string;
  entities: { id: string; entity_name: string }[];
  defaultEntityId?: string;
  editingFacility?: LoanFacilityWithDetails | null;
  propertyValuation?: number | null;
}

type LoanFacilityForm = {
  lender_id: string;
  entity_id: string;
  facility_type: string;
  product_name: string;
  account_reference: string;
  status: string;
  original_amount: string;
  current_balance: string;
  monthly_payment: string;
  repayment_type: string;
  rate_type: string;
  interest_rate: string;
  rate_expiry_date: string;
  revert_rate: string;
  term_start_date: string;
  term_end_date: string;
  early_repayment_charge_until: string;
  erc_percentage: string;
  ltv_at_drawdown: string;
  current_ltv: string;
  covenant_ltv_max: string;
  covenant_icr_min: string;
  arrangement_fee: string;
  valuation_fee: string;
  legal_fee: string;
  total_setup_costs: string;
  notes: string;
};

const emptyForm: LoanFacilityForm = {
  lender_id: '', entity_id: '', facility_type: 'term_mortgage', product_name: '', account_reference: '',
  status: 'active', original_amount: '', current_balance: '', monthly_payment: '', repayment_type: 'interest_only',
  rate_type: 'fixed', interest_rate: '', rate_expiry_date: '', revert_rate: '',
  term_start_date: '', term_end_date: '', early_repayment_charge_until: '', erc_percentage: '',
  ltv_at_drawdown: '', current_ltv: '', covenant_ltv_max: '', covenant_icr_min: '',
  arrangement_fee: '', valuation_fee: '', legal_fee: '', total_setup_costs: '',
  notes: '',
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

export function LoanFacilityModal({ open, onOpenChange, propertyId, entities, defaultEntityId, editingFacility, propertyValuation }: Props) {
  const { toast } = useToast();
  const createFacility = useCreateLoanFacility();
  const updateFacility = useUpdateLoanFacility();
  const [form, setForm] = useState<LoanFacilityForm>(emptyForm);
  const [showCosts, setShowCosts] = useState(false);
  const isEditing = !!editingFacility;

  useEffect(() => {
    if (editingFacility) {
      setForm({
        lender_id: editingFacility.lender_id,
        entity_id: editingFacility.entity_id,
        facility_type: editingFacility.facility_type,
        product_name: editingFacility.product_name || '',
        account_reference: editingFacility.account_reference || '',
        status: editingFacility.status,
        original_amount: editingFacility.original_amount?.toString() || '',
        current_balance: editingFacility.current_balance?.toString() || '',
        monthly_payment: editingFacility.monthly_payment?.toString() || '',
        repayment_type: editingFacility.repayment_type,
        rate_type: editingFacility.rate_type,
        interest_rate: editingFacility.interest_rate?.toString() || '',
        rate_expiry_date: editingFacility.rate_expiry_date || '',
        revert_rate: editingFacility.revert_rate?.toString() || '',
        term_start_date: editingFacility.term_start_date || '',
        term_end_date: editingFacility.term_end_date || '',
        early_repayment_charge_until: editingFacility.early_repayment_charge_until || '',
        erc_percentage: editingFacility.erc_percentage?.toString() || '',
        ltv_at_drawdown: editingFacility.ltv_at_drawdown?.toString() || '',
        current_ltv: editingFacility.current_ltv?.toString() || '',
        covenant_ltv_max: editingFacility.covenant_ltv_max?.toString() || '',
        covenant_icr_min: editingFacility.covenant_icr_min?.toString() || '',
        arrangement_fee: editingFacility.arrangement_fee?.toString() || '',
        valuation_fee: editingFacility.valuation_fee?.toString() || '',
        legal_fee: editingFacility.legal_fee?.toString() || '',
        total_setup_costs: editingFacility.total_setup_costs?.toString() || '',
        notes: editingFacility.notes || '',
      });
    } else {
      setForm({ ...emptyForm, entity_id: defaultEntityId || '' });
    }
  }, [editingFacility, defaultEntityId, open]);

  const setField = <K extends keyof LoanFacilityForm>(key: K, value: LoanFacilityForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const set = setField;

  const calcLtv = () => {
    const balance = parseFloat(form.current_balance);
    if (propertyValuation && balance) {
      setField('current_ltv', ((balance / propertyValuation) * 100).toFixed(2));
    }
  };

  const calcSetupCosts = () => {
    const arr = parseFloat(form.arrangement_fee) || 0;
    const val = parseFloat(form.valuation_fee) || 0;
    const leg = parseFloat(form.legal_fee) || 0;
    setField('total_setup_costs', (arr + val + leg).toString());
  };

  const handleSubmit = async () => {
    if (!form.lender_id || !form.entity_id || !form.interest_rate || !form.term_start_date || !form.term_end_date || !form.original_amount || !form.current_balance) {
      toast({ title: 'Please fill required fields', variant: 'destructive' });
      return;
    }
    const payload = {
      property_id: propertyId!,
      lender_id: form.lender_id,
      entity_id: form.entity_id,
      facility_type: form.facility_type,
      product_name: form.product_name || null,
      account_reference: form.account_reference || null,
      status: form.status,
      original_amount: parseFloat(form.original_amount),
      current_balance: parseFloat(form.current_balance),
      monthly_payment: form.monthly_payment ? parseFloat(form.monthly_payment) : null,
      repayment_type: form.repayment_type,
      interest_only: form.repayment_type === 'interest_only',
      rate_type: form.rate_type,
      interest_rate: parseFloat(form.interest_rate),
      rate_expiry_date: form.rate_expiry_date || null,
      revert_rate: form.revert_rate ? parseFloat(form.revert_rate) : null,
      term_start_date: form.term_start_date,
      term_end_date: form.term_end_date,
      early_repayment_charge_until: form.early_repayment_charge_until || null,
      erc_percentage: form.erc_percentage ? parseFloat(form.erc_percentage) : null,
      ltv_at_drawdown: form.ltv_at_drawdown ? parseFloat(form.ltv_at_drawdown) : null,
      current_ltv: form.current_ltv ? parseFloat(form.current_ltv) : null,
      covenant_ltv_max: form.covenant_ltv_max ? parseFloat(form.covenant_ltv_max) : null,
      covenant_icr_min: form.covenant_icr_min ? parseFloat(form.covenant_icr_min) : null,
      arrangement_fee: form.arrangement_fee ? parseFloat(form.arrangement_fee) : null,
      valuation_fee: form.valuation_fee ? parseFloat(form.valuation_fee) : null,
      legal_fee: form.legal_fee ? parseFloat(form.legal_fee) : null,
      total_setup_costs: form.total_setup_costs ? parseFloat(form.total_setup_costs) : null,
      notes: form.notes || null,
    };

    try {
      if (isEditing) {
        await updateFacility.mutateAsync({ id: editingFacility!.id, ...payload });
        toast({ title: 'Loan facility updated' });
      } else {
        await createFacility.mutateAsync(payload);
        toast({ title: 'Loan facility created' });
      }
      onOpenChange(false);
    } catch (err: unknown) {
      console.error('Failed to save loan facility:', err);
      toast({ title: 'Error', description: getErrorMessage(err), variant: 'destructive' });
    }
  };

  const showRateExpiry = form.rate_type === 'fixed' || form.rate_type === 'discount';
  const isPending = createFacility.isPending || updateFacility.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isEditing ? 'Edit' : 'Add'} Loan Facility</DialogTitle></DialogHeader>
        <div className="space-y-5">
          {/* Loan Details */}
          <Section title="Loan Details">
            <div><Label>Lender *</Label><LenderSelector value={form.lender_id} onChange={v => set('lender_id', v)} /></div>
            <div><Label>Borrowing Entity *</Label>
              <Select value={form.entity_id} onValueChange={v => set('entity_id', v)}>
                <SelectTrigger><SelectValue placeholder="Select entity..." /></SelectTrigger>
                <SelectContent>{entities.map(e => <SelectItem key={e.id} value={e.id}>{e.entity_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Facility Type *</Label>
                <Select value={form.facility_type} onValueChange={v => set('facility_type', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{FACILITY_TYPES.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Status</Label>
                <Select value={form.status} onValueChange={v => set('status', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="pending_drawdown">Pending Drawdown</SelectItem>
                    <SelectItem value="redeemed">Redeemed</SelectItem>
                    <SelectItem value="in_arrears">In Arrears</SelectItem>
                    <SelectItem value="default">Default</SelectItem>
                    <SelectItem value="expired_product">Expired Product</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Product Name</Label><Input value={form.product_name} onChange={e => set('product_name', e.target.value)} placeholder="e.g. 5yr Fixed BTL" /></div>
              <div><Label>Account Reference</Label><Input value={form.account_reference} onChange={e => set('account_reference', e.target.value)} /></div>
            </div>
          </Section>

          {/* Amounts */}
          <Section title="Amounts">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Original Amount (£) *</Label><Input type="number" value={form.original_amount} onChange={e => { set('original_amount', e.target.value); if (!form.current_balance) set('current_balance', e.target.value); }} /></div>
              <div><Label>Current Balance (£) *</Label><Input type="number" value={form.current_balance} onChange={e => set('current_balance', e.target.value)} onBlur={calcLtv} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Monthly Payment (£)</Label><Input type="number" value={form.monthly_payment} onChange={e => set('monthly_payment', e.target.value)} /></div>
              <div><Label>Repayment Type *</Label>
                <Select value={form.repayment_type} onValueChange={v => set('repayment_type', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{REPAYMENT_TYPES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </Section>

          {/* Rate */}
          <Section title="Rate">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Rate Type *</Label>
                <Select value={form.rate_type} onValueChange={v => set('rate_type', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{RATE_TYPES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Interest Rate (%) *</Label><Input type="number" step="0.001" value={form.interest_rate} onChange={e => set('interest_rate', e.target.value)} /></div>
            </div>
            {showRateExpiry && (
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Rate Expiry Date</Label><Input type="date" value={form.rate_expiry_date} onChange={e => set('rate_expiry_date', e.target.value)} /></div>
                <div><Label>Revert Rate (%)</Label><Input type="number" step="0.001" value={form.revert_rate} onChange={e => set('revert_rate', e.target.value)} placeholder="SVR after fixed period" /></div>
              </div>
            )}
          </Section>

          {/* Term */}
          <Section title="Term">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Start Date *</Label><Input type="date" value={form.term_start_date} onChange={e => set('term_start_date', e.target.value)} /></div>
              <div><Label>End Date *</Label><Input type="date" value={form.term_end_date} onChange={e => set('term_end_date', e.target.value)} /></div>
            </div>
          </Section>

          {/* ERC */}
          <Section title="Early Repayment Charge">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>ERC Until</Label><Input type="date" value={form.early_repayment_charge_until} onChange={e => set('early_repayment_charge_until', e.target.value)} /></div>
              {form.early_repayment_charge_until && (
                <div><Label>ERC %</Label><Input type="number" step="0.01" value={form.erc_percentage} onChange={e => set('erc_percentage', e.target.value)} /></div>
              )}
            </div>
          </Section>

          {/* LTV & Covenants */}
          <Section title="LTV & Covenants">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>LTV at Drawdown (%)</Label><Input type="number" step="0.01" value={form.ltv_at_drawdown} onChange={e => set('ltv_at_drawdown', e.target.value)} /></div>
              <div><Label>Current LTV (%)</Label><Input type="number" step="0.01" value={form.current_ltv} onChange={e => set('current_ltv', e.target.value)} placeholder={propertyValuation ? 'Auto-calculated' : ''} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Covenant Max LTV (%)</Label><Input type="number" step="0.01" value={form.covenant_ltv_max} onChange={e => set('covenant_ltv_max', e.target.value)} placeholder="Max LTV before breach" /></div>
              <div><Label>Covenant Min ICR</Label><Input type="number" step="0.01" value={form.covenant_icr_min} onChange={e => set('covenant_icr_min', e.target.value)} placeholder="Min interest cover ratio" /></div>
            </div>
          </Section>

          {/* Costs */}
          <Collapsible open={showCosts} onOpenChange={setShowCosts}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full text-muted-foreground">
                <ChevronDown className={`h-4 w-4 mr-1 transition-transform ${showCosts ? 'rotate-180' : ''}`} /> Setup Costs
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-2">
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Arrangement Fee (£)</Label><Input type="number" value={form.arrangement_fee} onChange={e => set('arrangement_fee', e.target.value)} onBlur={calcSetupCosts} /></div>
                <div><Label>Valuation Fee (£)</Label><Input type="number" value={form.valuation_fee} onChange={e => set('valuation_fee', e.target.value)} onBlur={calcSetupCosts} /></div>
                <div><Label>Legal Fee (£)</Label><Input type="number" value={form.legal_fee} onChange={e => set('legal_fee', e.target.value)} onBlur={calcSetupCosts} /></div>
              </div>
              <div><Label>Total Setup Costs (£)</Label><Input type="number" value={form.total_setup_costs} onChange={e => set('total_setup_costs', e.target.value)} /></div>
            </CollapsibleContent>
          </Collapsible>

          {/* Notes */}
          <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} /></div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isPending}>{isEditing ? 'Update' : 'Add'} Loan Facility</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground border-b pb-1">{title}</h3>
      {children}
    </div>
  );
}
