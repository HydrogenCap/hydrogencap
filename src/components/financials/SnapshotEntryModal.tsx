import { useState, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Lock, Unlock, ChevronDown, ChevronUp, Save, AlertCircle } from 'lucide-react';
import { usePropertiesV2, type PropertyWithEntity } from '@/hooks/usePropertiesV2';
import { useMonthSnapshots, useUpsertSnapshot, useLockMonth } from '@/hooks/useFinancialSnapshots';
import { useToast } from '@/hooks/use-toast';
import { formatGBPDecimal } from '@/lib/calculations';
import { cn } from '@/lib/utils';
import { format, startOfMonth, subMonths } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import type { Database } from '@/integrations/supabase/types';
import type { FinancialSnapshot } from '@/lib/financialSnapshotTypes';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedPropertyId?: string;
}

type EntryTab = 'detailed' | 'quick';
type RoomSuggestion = Pick<
  Database['public']['Tables']['rooms_v2']['Row'],
  'property_id' | 'current_rent_pcm' | 'is_lettable' | 'occupancy_status' | 'target_rent_pcm'
>;
type LoanSuggestion = Pick<
  Database['public']['Tables']['loan_facilities']['Row'],
  'property_id' | 'monthly_payment' | 'current_balance' | 'status'
>;
type SnapshotUpsertInput = Omit<
  FinancialSnapshot,
  'id' | 'total_costs' | 'net_operating_income' | 'net_cash_flow' | 'rent_collection_rate' | 'created_at' | 'updated_at'
>;
type SnapshotFormValues = Pick<
  SnapshotUpsertInput,
  | 'gross_rent_due'
  | 'gross_rent_received'
  | 'void_loss'
  | 'other_income'
  | 'management_fees'
  | 'maintenance_costs'
  | 'insurance_costs'
  | 'mortgage_payments'
  | 'utilities'
  | 'council_tax'
  | 'licensing_costs'
  | 'professional_fees'
  | 'other_costs'
  | 'valuation_at_snapshot'
  | 'debt_at_snapshot'
> & {
  notes: string;
};
type SnapshotNumericField = Exclude<keyof SnapshotFormValues, 'notes'>;

interface AutoSuggestions {
  grossRentDue: number;
  voidLoss: number;
  occupancyRate: number;
  mortgagePayments: number;
  totalDebt: number;
  valuation: number;
  equity: number;
  ltv: number;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

function getMonthOptions() {
  const now = new Date();
  return Array.from({ length: 13 }, (_, i) => {
    const d = startOfMonth(subMonths(now, i));
    return { value: format(d, 'yyyy-MM-dd'), label: format(d, 'MMMM yyyy') };
  });
}

export function SnapshotEntryModal({ open, onOpenChange, preselectedPropertyId }: Props) {
  const { toast } = useToast();
  const months = getMonthOptions();
  const [selectedMonth, setSelectedMonth] = useState(months[0].value);
  const [showAll, setShowAll] = useState(false);
  const [tab, setTab] = useState<EntryTab>('detailed');
  const [expandedProperty, setExpandedProperty] = useState<string | null>(preselectedPropertyId || null);

  const { data: properties, isLoading: propsLoading } = usePropertiesV2();
  const { data: existingSnapshots, isLoading: snapshotsLoading } = useMonthSnapshots(selectedMonth);
  const upsertSnapshot = useUpsertSnapshot();
  const lockMonth = useLockMonth();

  // Auto-suggestions: get room rent and loan payments
  const { data: roomSuggestions } = useQuery<RoomSuggestion[]>({
    queryKey: ['room_rent_suggestions'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('rooms_v2')
        .select('property_id, current_rent_pcm, is_lettable, occupancy_status, target_rent_pcm');
      return (data || []) as RoomSuggestion[];
    },
  });

  const { data: loanSuggestions } = useQuery<LoanSuggestion[]>({
    queryKey: ['loan_payment_suggestions'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('loan_facilities')
        .select('property_id, monthly_payment, current_balance, status')
        .eq('status', 'active');
      return (data || []) as LoanSuggestion[];
    },
  });

  const filteredProperties = useMemo(() => {
    if (!properties) return [];
    if (showAll) return properties;
    return properties.filter(p => ['letting', 'stabilised'].includes(p.lifecycle_stage));
  }, [properties, showAll]);

  const isMonthLocked = existingSnapshots?.some(s => s.is_locked) || false;
  const existingCount = existingSnapshots?.length || 0;

  const getAutoSuggestions = useCallback((propertyId: string): AutoSuggestions => {
    const rooms = roomSuggestions?.filter(r => r.property_id === propertyId) || [];
    const lettableRooms = rooms.filter(r => r.is_lettable);
    const occupiedRooms = lettableRooms.filter(r => r.occupancy_status === 'occupied');
    const vacantRooms = lettableRooms.filter(r => r.occupancy_status !== 'occupied');

    const grossRentDue = occupiedRooms.reduce((s, r) => s + (r.current_rent_pcm || 0), 0);
    const voidLoss = vacantRooms.reduce((s, r) => s + (r.target_rent_pcm || 0), 0);
    const occupancyRate = lettableRooms.length > 0 ? (occupiedRooms.length / lettableRooms.length) * 100 : 0;

    const loans = loanSuggestions?.filter(l => l.property_id === propertyId) || [];
    const mortgagePayments = loans.reduce((s, l) => s + (l.monthly_payment || 0), 0);
    const totalDebt = loans.reduce((s, l) => s + (l.current_balance || 0), 0);

    // Get valuation from property
    const property = properties?.find(p => p.id === propertyId);
    const valuation = property?.current_valuation || 0;
    const equity = valuation - totalDebt;
    const ltv = valuation > 0 ? Math.round((totalDebt / valuation) * 10000) / 100 : 0;

    return { grossRentDue, voidLoss, occupancyRate, mortgagePayments, totalDebt, valuation, equity, ltv };
  }, [roomSuggestions, loanSuggestions, properties]);

  const getExistingSnapshot = useCallback((propertyId: string) => {
    return existingSnapshots?.find(s => s.property_id === propertyId);
  }, [existingSnapshots]);

  if (propsLoading || snapshotsLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Record Monthly Figures</DialogTitle>
            <DialogDescription>Loading snapshot data…</DialogDescription>
          </DialogHeader>
          <Skeleton className="h-64" />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record Monthly Figures</DialogTitle>
          <DialogDescription>
            Record the month-end financial snapshot for this property or portfolio.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Month selector + controls */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Label>Month:</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {existingCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                <AlertCircle className="h-3 w-3 mr-1" />{existingCount} existing
              </Badge>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <Label className="text-xs">Show all stages</Label>
              <Switch checked={showAll} onCheckedChange={setShowAll} />
            </div>
            <Button
              variant={isMonthLocked ? 'destructive' : 'outline'}
              size="sm"
              onClick={() => lockMonth.mutate({ month: selectedMonth, lock: !isMonthLocked }, {
                onSuccess: () => toast({ title: isMonthLocked ? 'Month unlocked' : 'Month locked' }),
              })}
            >
              {isMonthLocked ? <><Unlock className="h-3 w-3 mr-1" /> Unlock</> : <><Lock className="h-3 w-3 mr-1" /> Lock Month</>}
            </Button>
          </div>

          {/* Tabs: Detailed / Quick */}
          <Tabs value={tab} onValueChange={(value) => setTab(value as EntryTab)}>
            <TabsList>
              <TabsTrigger value="detailed">Detailed Entry</TabsTrigger>
              <TabsTrigger value="quick">Quick Entry</TabsTrigger>
            </TabsList>

            <TabsContent value="detailed" className="space-y-2 mt-4">
              {filteredProperties.map(property => (
                <PropertySnapshotEntry
                  key={property.id}
                  property={property}
                  month={selectedMonth}
                  existing={getExistingSnapshot(property.id)}
                  suggestions={getAutoSuggestions(property.id)}
                  isExpanded={expandedProperty === property.id}
                  onToggle={() => setExpandedProperty(expandedProperty === property.id ? null : property.id)}
                  isLocked={isMonthLocked}
                  onSave={upsertSnapshot}
                />
              ))}
            </TabsContent>

            <TabsContent value="quick" className="mt-4">
              <QuickEntryTable
                properties={filteredProperties}
                month={selectedMonth}
                existingSnapshots={existingSnapshots || []}
                getAutoSuggestions={getAutoSuggestions}
                isLocked={isMonthLocked}
                onSave={upsertSnapshot}
              />
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Detailed per-property entry ──
interface EntryProps {
  property: PropertyWithEntity;
  month: string;
  existing: FinancialSnapshot | undefined;
  suggestions: AutoSuggestions;
  isExpanded: boolean;
  onToggle: () => void;
  isLocked: boolean;
  onSave: ReturnType<typeof useUpsertSnapshot>;
}

function PropertySnapshotEntry({ property, month, existing, suggestions, isExpanded, onToggle, isLocked, onSave }: EntryProps) {
  const { toast } = useToast();
  const [values, setValues] = useState<SnapshotFormValues>(() => ({
    gross_rent_due: existing?.gross_rent_due ?? suggestions.grossRentDue,
    gross_rent_received: existing?.gross_rent_received ?? suggestions.grossRentDue,
    void_loss: existing?.void_loss ?? suggestions.voidLoss,
    other_income: existing?.other_income ?? 0,
    management_fees: existing?.management_fees ?? 0,
    maintenance_costs: existing?.maintenance_costs ?? 0,
    insurance_costs: existing?.insurance_costs ?? 0,
    mortgage_payments: existing?.mortgage_payments ?? suggestions.mortgagePayments,
    utilities: existing?.utilities ?? 0,
    council_tax: existing?.council_tax ?? 0,
    licensing_costs: existing?.licensing_costs ?? 0,
    professional_fees: existing?.professional_fees ?? 0,
    other_costs: existing?.other_costs ?? 0,
    notes: existing?.notes ?? '',
    // Balance sheet
    valuation_at_snapshot: existing?.valuation_at_snapshot ?? suggestions.valuation,
    debt_at_snapshot: existing?.debt_at_snapshot ?? suggestions.totalDebt,
  }));

  const equityAtSnapshot = (values.valuation_at_snapshot || 0) - (values.debt_at_snapshot || 0);
  const ltvAtSnapshot = values.valuation_at_snapshot > 0 ? Math.round(((values.debt_at_snapshot || 0) / values.valuation_at_snapshot) * 10000) / 100 : 0;

  const totalCosts = values.management_fees + values.maintenance_costs + values.insurance_costs +
    values.utilities + values.council_tax + values.licensing_costs + values.professional_fees + values.other_costs;
  const noi = values.gross_rent_received + values.other_income - totalCosts;
  const cashflow = noi - values.mortgage_payments;

  const handleSave = () => {
    onSave.mutate({
      org_id: property.org_id,
      property_id: property.id,
      entity_id: property.entity_id,
      snapshot_month: month,
      ...values,
      occupancy_rate: suggestions.occupancyRate,
      // Balance sheet derived fields
      equity_at_snapshot: equityAtSnapshot,
      ltv_at_snapshot: ltvAtSnapshot,
      is_locked: false,
      locked_at: null,
      locked_by: null,
    }, {
      onSuccess: () => toast({ title: `Saved for ${property.address_line_1}` }),
      onError: (err: unknown) => toast({ title: 'Error', description: getErrorMessage(err), variant: 'destructive' }),
    });
  };

  const setField = (field: SnapshotNumericField, val: string) => {
    setValues(prev => ({ ...prev, [field]: parseFloat(val) || 0 }));
  };

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <Card className={cn(isLocked && 'opacity-60')}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isLocked && <Lock className="h-3 w-3 text-muted-foreground" />}
                <span className="font-medium">{property.address_line_1}, {property.postcode}</span>
                <Badge variant="secondary" className="text-xs">{property.entity_name}</Badge>
                {existing && <Badge className="bg-emerald-100 text-emerald-700 text-xs">Saved</Badge>}
              </div>
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Income */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground">Income</h4>
                <NumberField label="Gross Rent Due" value={values.gross_rent_due} onChange={v => setField('gross_rent_due', v)} disabled={isLocked} />
                <NumberField label="Gross Rent Received" value={values.gross_rent_received} onChange={v => setField('gross_rent_received', v)} disabled={isLocked} />
                <NumberField label="Void Loss" value={values.void_loss} onChange={v => setField('void_loss', v)} disabled={isLocked} />
                <NumberField label="Other Income" value={values.other_income} onChange={v => setField('other_income', v)} disabled={isLocked} />
              </div>
              {/* Expenses */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground">Expenses</h4>
                <NumberField label="Management Fees" value={values.management_fees} onChange={v => setField('management_fees', v)} disabled={isLocked} />
                <NumberField label="Maintenance" value={values.maintenance_costs} onChange={v => setField('maintenance_costs', v)} disabled={isLocked} />
                <NumberField label="Insurance" value={values.insurance_costs} onChange={v => setField('insurance_costs', v)} disabled={isLocked} />
                <NumberField label="Mortgage Payments" value={values.mortgage_payments} onChange={v => setField('mortgage_payments', v)} disabled={isLocked} />
                <NumberField label="Utilities" value={values.utilities} onChange={v => setField('utilities', v)} disabled={isLocked} />
                <NumberField label="Council Tax" value={values.council_tax} onChange={v => setField('council_tax', v)} disabled={isLocked} />
                <NumberField label="Licensing" value={values.licensing_costs} onChange={v => setField('licensing_costs', v)} disabled={isLocked} />
                <NumberField label="Professional Fees" value={values.professional_fees} onChange={v => setField('professional_fees', v)} disabled={isLocked} />
                <NumberField label="Other Costs" value={values.other_costs} onChange={v => setField('other_costs', v)} disabled={isLocked} />
              </div>
              {/* Balance Sheet */}
              <div className="space-y-3 md:col-span-2">
                <h4 className="text-sm font-medium text-muted-foreground">Balance Sheet (Point-in-Time)</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <NumberField label="Valuation" value={values.valuation_at_snapshot} onChange={v => setField('valuation_at_snapshot', v)} disabled={isLocked} />
                  <NumberField label="Total Debt" value={values.debt_at_snapshot} onChange={v => setField('debt_at_snapshot', v)} disabled={isLocked} />
                  <div className="flex items-center gap-2">
                    <Label className="text-xs w-32 shrink-0">Equity</Label>
                    <span className={cn('text-sm font-bold', equityAtSnapshot >= 0 ? 'text-success' : 'text-destructive')}>{formatGBPDecimal(equityAtSnapshot)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs w-32 shrink-0">LTV</Label>
                    <span className={cn('text-sm font-bold', ltvAtSnapshot > 75 ? 'text-destructive' : 'text-foreground')}>{ltvAtSnapshot.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Calculated fields */}
            <div className="grid grid-cols-3 gap-4 mt-4 p-3 bg-muted/50 rounded-lg">
              <div>
                <span className="text-xs text-muted-foreground">Total Costs</span>
                <p className="font-bold">{formatGBPDecimal(totalCosts)}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">NOI</span>
                <p className={cn('font-bold', noi >= 0 ? 'text-success' : 'text-destructive')}>{formatGBPDecimal(noi)}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Cash Flow</span>
                <p className={cn('font-bold', cashflow >= 0 ? 'text-success' : 'text-destructive')}>{formatGBPDecimal(cashflow)}</p>
              </div>
            </div>

            {/* Notes + Save */}
            <div className="mt-4 space-y-3">
              <Textarea
                placeholder="Notes..."
                value={values.notes}
                onChange={e => setValues(prev => ({ ...prev, notes: e.target.value }))}
                disabled={isLocked}
                rows={2}
              />
              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={isLocked || onSave.isPending} size="sm">
                  <Save className="h-3 w-3 mr-1" /> Save
                </Button>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// ── Quick Entry Table ──
interface QuickProps {
  properties: PropertyWithEntity[];
  month: string;
  existingSnapshots: FinancialSnapshot[];
  getAutoSuggestions: (id: string) => AutoSuggestions;
  isLocked: boolean;
  onSave: ReturnType<typeof useUpsertSnapshot>;
}

function QuickEntryTable({ properties, month, existingSnapshots, getAutoSuggestions, isLocked, onSave }: QuickProps) {
  const { toast } = useToast();
  const [rows, setRows] = useState<Record<string, Record<string, number>>>(() => {
    const init: Record<string, Record<string, number>> = {};
    properties.forEach(p => {
      const existing = existingSnapshots.find(s => s.property_id === p.id);
      const suggestions = getAutoSuggestions(p.id);
      init[p.id] = {
        gross_rent_due: existing?.gross_rent_due ?? suggestions.grossRentDue,
        gross_rent_received: existing?.gross_rent_received ?? suggestions.grossRentDue,
        management_fees: existing?.management_fees ?? 0,
        maintenance_costs: existing?.maintenance_costs ?? 0,
        insurance_costs: existing?.insurance_costs ?? 0,
        mortgage_payments: existing?.mortgage_payments ?? suggestions.mortgagePayments,
        utilities: existing?.utilities ?? 0,
        council_tax: existing?.council_tax ?? 0,
        other_costs: existing?.other_costs ?? 0,
      };
    });
    return init;
  });

  const updateCell = (propertyId: string, field: string, val: string) => {
    setRows(prev => ({
      ...prev,
      [propertyId]: { ...prev[propertyId], [field]: parseFloat(val) || 0 },
    }));
  };

  const saveAll = () => {
    const promises = properties.map(p => {
      const r = rows[p.id];
      const suggestions = getAutoSuggestions(p.id);
      return onSave.mutateAsync({
        org_id: p.org_id,
        property_id: p.id,
        entity_id: p.entity_id,
        snapshot_month: month,
        gross_rent_due: r.gross_rent_due,
        gross_rent_received: r.gross_rent_received,
        void_loss: suggestions.voidLoss,
        other_income: 0,
        management_fees: r.management_fees,
        maintenance_costs: r.maintenance_costs,
        insurance_costs: r.insurance_costs,
        mortgage_payments: r.mortgage_payments,
        utilities: r.utilities,
        council_tax: r.council_tax,
        licensing_costs: 0,
        professional_fees: 0,
        other_costs: r.other_costs,
        occupancy_rate: suggestions.occupancyRate,
        // Balance sheet auto-populated from current property/loan data
        valuation_at_snapshot: suggestions.valuation || null,
        debt_at_snapshot: suggestions.totalDebt || null,
        equity_at_snapshot: (suggestions.valuation || 0) - (suggestions.totalDebt || 0) || null,
        ltv_at_snapshot: suggestions.valuation > 0 ? Math.round((suggestions.totalDebt / suggestions.valuation) * 10000) / 100 : null,
        notes: null,
        is_locked: false,
        locked_at: null,
        locked_by: null,
      });
    });

    Promise.all(promises)
      .then(() => toast({ title: `Saved ${properties.length} snapshots` }))
      .catch((err) => toast({ title: 'Error', description: err.message, variant: 'destructive' }));
  };

  const fields = [
    { key: 'gross_rent_due', label: 'Rent Due' },
    { key: 'gross_rent_received', label: 'Received' },
    { key: 'management_fees', label: 'Mgmt' },
    { key: 'maintenance_costs', label: 'Maint.' },
    { key: 'insurance_costs', label: 'Insurance' },
    { key: 'mortgage_payments', label: 'Mortgage' },
    { key: 'utilities', label: 'Utils' },
    { key: 'council_tax', label: 'CT' },
    { key: 'other_costs', label: 'Other' },
  ];

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="px-2 py-1 text-left font-medium text-muted-foreground sticky left-0 bg-background">Property</th>
              {fields.map(f => <th key={f.key} className="px-1 py-1 text-center font-medium text-muted-foreground min-w-[80px]">{f.label}</th>)}
              <th className="px-1 py-1 text-center font-medium text-muted-foreground">NOI</th>
            </tr>
          </thead>
          <tbody>
            {properties.map(p => {
              const r = rows[p.id] || {};
              const totalCosts = (r.management_fees || 0) + (r.maintenance_costs || 0) + (r.insurance_costs || 0) +
                (r.utilities || 0) + (r.council_tax || 0) + (r.other_costs || 0);
              const noi = (r.gross_rent_received || 0) - totalCosts;
              return (
                <tr key={p.id} className="border-b border-border/50">
                  <td className="px-2 py-1 font-medium truncate max-w-[150px] sticky left-0 bg-background">{p.address_line_1}</td>
                  {fields.map(f => (
                    <td key={f.key} className="px-1 py-1">
                      <Input
                        type="number"
                        className="h-7 text-xs text-center w-full"
                        value={r[f.key] || 0}
                        onChange={e => updateCell(p.id, f.key, e.target.value)}
                        disabled={isLocked}
                      />
                    </td>
                  ))}
                  <td className={cn('px-1 py-1 text-center font-bold', noi >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                    {formatGBPDecimal(noi)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end">
        <Button onClick={saveAll} disabled={isLocked || onSave.isPending}>
          <Save className="h-4 w-4 mr-2" /> Save All
        </Button>
      </div>
    </div>
  );
}

// ── Number field helper ──
function NumberField({ label, value, onChange, disabled }: {
  label: string; value: number; onChange: (val: string) => void; disabled: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <Label className="text-xs w-32 shrink-0">{label}</Label>
      <div className="relative flex-1">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">£</span>
        <Input
          type="number"
          value={value}
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
          className="pl-6 h-8 text-sm"
          step="0.01"
        />
      </div>
    </div>
  );
}
