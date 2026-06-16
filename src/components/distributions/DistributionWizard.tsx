import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useQuery } from '@tanstack/react-query';
import { supabaseAny } from '@/integrations/supabase/client';
import { useUserOrg } from '@/hooks/useUserOrg';
import { useCreateDistributionRun, useMarkPayment, useMarkAllPayments, useDistributionLineItems } from '@/hooks/useDistributionWorkflow';
import {
  getQuarterFromDate,
  calculateDistributableIncome,
  calculateRetainedEarnings,
  allocateToInvestors,
  type EntityOwnership,
  type AllocationResult,
  type PeriodFinancials,
} from '@/lib/distribution-calculator';

import { WizardStepper } from './wizard/WizardStepper';
import { PeriodStep } from './wizard/steps/PeriodStep';
import { AllocationStep } from './wizard/steps/AllocationStep';
import { ReviewStep } from './wizard/steps/ReviewStep';
import { PaymentTrackingStep } from './wizard/steps/PaymentTrackingStep';

interface DistributionWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingRunId?: string | null;
}

export function DistributionWizard({ open, onOpenChange, existingRunId }: DistributionWizardProps) {
  const { data: orgId } = useUserOrg();
  const [step, setStep] = useState(existingRunId ? 3 : 0);
  const [entityId, setEntityId] = useState('');
  const quarter = getQuarterFromDate();
  const [period, setPeriod] = useState(quarter.period);
  const [periodStart, setPeriodStart] = useState(quarter.start);
  const [periodEnd, setPeriodEnd] = useState(quarter.end);
  const [retentionPct, setRetentionPct] = useState(10);
  const [notes, setNotes] = useState('');
  const [overrides, setOverrides] = useState<Record<string, number>>({});

  const createRun = useCreateDistributionRun();
  const markPayment = useMarkPayment();
  const markAllPayments = useMarkAllPayments();

  const { data: existingLineItems } = useDistributionLineItems(existingRunId || null);

  const { data: entities } = useQuery({
    queryKey: ['entities-for-dist-wizard', orgId],
    queryFn: async () => {
      const { data } = await supabaseAny
        .from('legal_entities')
        .select('id, entity_name')
        .eq('org_id', orgId!);
      return data || [];
    },
    enabled: !!orgId,
  });

  const { data: shareholders } = useQuery({
    queryKey: ['entity-shareholders-wizard', entityId],
    queryFn: async () => {
      const { data } = await supabaseAny
        .from('entity_shareholders')
        .select('id, shareholder_name, percentage, shareholder_entity_id')
        .eq('entity_id', entityId)
        .is('effective_to', null);
      return data || [];
    },
    enabled: !!entityId,
  });

  const { data: investors } = useQuery({
    queryKey: ['investors-for-dist-wizard', orgId],
    queryFn: async () => {
      const { data } = await supabaseAny
        .from('investors')
        .select('id, investor_name, email')
        .eq('org_id', orgId!);
      return data || [];
    },
    enabled: !!orgId,
  });

  const { data: financials } = useQuery({
    queryKey: ['dist-wizard-financials', entityId, periodStart, periodEnd],
    queryFn: async () => {
      if (!entityId || !orgId) return { grossRent: 0, expenses: 0, mortgagePayments: 0, managementFees: 0, otherDeductions: 0 };

      const { data: props } = await supabaseAny
        .from('properties_v2')
        .select('id')
        .eq('entity_id', entityId)
        .eq('org_id', orgId);

      const propertyIds = (props || []).map(p => p.id);
      if (propertyIds.length === 0) return { grossRent: 0, expenses: 0, mortgagePayments: 0, managementFees: 0, otherDeductions: 0 };

      const { data: agreements } = await supabaseAny
        .from('tenancy_agreements')
        .select('id')
        .in('property_id', propertyIds);

      let grossRent = 0;
      if (agreements && agreements.length > 0) {
        const { data: payments } = await supabaseAny
          .from('rent_payments')
          .select('amount')
          .in('tenancy_id', agreements.map(a => a.id))
          .gte('payment_date', periodStart)
          .lte('payment_date', periodEnd);
        grossRent = (payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
      }

      const { data: maintenance } = await supabaseAny
        .from('maintenance_requests')
        .select('actual_cost')
        .in('property_id', propertyIds)
        .gte('created_at', periodStart)
        .lte('created_at', periodEnd);
      const expenses = (maintenance || []).reduce((sum, m) => sum + (m.actual_cost || 0), 0);

      const { data: loans } = await supabaseAny
        .from('loan_facilities')
        .select('monthly_payment')
        .in('property_id', propertyIds)
        .eq('status', 'active');

      const months = Math.max(1, Math.round(
        (new Date(periodEnd).getTime() - new Date(periodStart).getTime()) / (30.44 * 24 * 60 * 60 * 1000)
      ));
      const mortgagePayments = (loans || []).reduce((sum, l) => sum + (l.monthly_payment || 0), 0) * months;

      return { grossRent, expenses, mortgagePayments, managementFees: 0, otherDeductions: 0 } as PeriodFinancials;
    },
    enabled: !!entityId && !!periodStart && !!periodEnd,
  });

  const noi = financials ? calculateDistributableIncome(financials) : 0;
  const { retained, distributable } = calculateRetainedEarnings(noi, retentionPct);

  const ownerships: EntityOwnership[] = useMemo(() => {
    if (!shareholders?.length) return [];
    type InvestorRow = { id: string; investor_name?: string | null };
    type ShareholderRow = {
      id: string;
      shareholder_name?: string | null;
      percentage?: number | null;
      shareholder_entity_id?: string | null;
    };
    const investorRows = (investors as InvestorRow[] | undefined) ?? [];
    const investorMap = new Map(investorRows.map((i) => [i.id, i]));

    return (shareholders as ShareholderRow[]).map(s => {
      const investorId = s.shareholder_entity_id;
      const inv = investorId ? investorMap.get(investorId) : null;
      return {
        investorId: investorId || s.id,
        investorName: inv?.investor_name || s.shareholder_name,
        entityId: entityId || null,
        entityName: entities?.find(e => e.id === entityId)?.entity_name || null,
        ownershipPct: s.percentage,
        entityType: 'spv' as const,
        propertyIds: [],
      };
    });
  }, [shareholders, investors, entityId, entities]);

  const allocations: AllocationResult[] = useMemo(() => {
    if (distributable <= 0 || ownerships.length === 0) return [];
    const allocs = allocateToInvestors(distributable, ownerships);

    return allocs.map(a => {
      const override = overrides[a.investorId];
      if (override !== undefined && override !== a.grossAmount) {
        return {
          ...a,
          grossAmount: override,
          netAmount: override - a.withholdingTax,
        };
      }
      return a;
    });
  }, [distributable, ownerships, overrides]);

  const totalAllocated = allocations.reduce((s, a) => s + a.grossAmount, 0);
  const totalOwnership = allocations.reduce((s, a) => s + a.ownershipPct, 0);

  const handleCreate = async () => {
    if (!orgId) return;
    try {
      await createRun.mutateAsync({
        period,
        period_start: periodStart,
        period_end: periodEnd,
        total_distributable: distributable,
        total_distributed: totalAllocated,
        retained_amount: retained,
        notes: notes || undefined,
        allocations,
      });
      setStep(3);
    } catch {
      // Error handled by mutation
    }
  };

  const canProceedStep0 = !!entityId && !!periodStart && !!periodEnd;
  const canProceedStep1 = allocations.length > 0 && Math.abs(totalOwnership - 100) < 0.1;
  const entityName = entities?.find(e => e.id === entityId)?.entity_name || '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Distribution Run</DialogTitle>
          <DialogDescription>
            Build a new distribution run step-by-step: pick the entity, period, amount, and review allocations before approval.
          </DialogDescription>
        </DialogHeader>

        <WizardStepper step={step} />

        {step === 0 && (
          <PeriodStep
            entities={entities}
            entityId={entityId}
            setEntityId={setEntityId}
            period={period}
            setPeriod={setPeriod}
            periodStart={periodStart}
            setPeriodStart={setPeriodStart}
            periodEnd={periodEnd}
            setPeriodEnd={setPeriodEnd}
            retentionPct={retentionPct}
            setRetentionPct={setRetentionPct}
            financials={financials}
            noi={noi}
            retained={retained}
            distributable={distributable}
            canProceed={canProceedStep0}
            onNext={() => setStep(1)}
          />
        )}

        {step === 1 && (
          <AllocationStep
            allocations={allocations}
            totalAllocated={totalAllocated}
            totalOwnership={totalOwnership}
            canProceed={canProceedStep1}
            setOverrides={setOverrides}
            onBack={() => setStep(0)}
            onNext={() => setStep(2)}
          />
        )}

        {step === 2 && (
          <ReviewStep
            period={period}
            entityName={entityName}
            allocations={allocations}
            distributable={distributable}
            totalAllocated={totalAllocated}
            retained={retained}
            notes={notes}
            setNotes={setNotes}
            onBack={() => setStep(1)}
            onApprove={handleCreate}
            isCreating={createRun.isPending}
          />
        )}

        {step === 3 && (
          <PaymentTrackingStep
            lineItems={existingLineItems || []}
            runId={existingRunId || null}
            onMarkPaid={(id, ref) => markPayment.mutate({ id, reference: ref })}
            onMarkAllPaid={() => existingRunId && markAllPayments.mutate(existingRunId)}
            isPending={markPayment.isPending || markAllPayments.isPending}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
