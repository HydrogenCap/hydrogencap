import { useState, useMemo, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useTenantV2, useUpdateTenantV2, type TenantStatusV2 } from '@/hooks/useTenantsV2';
import { useTenancyAgreements, useTenancyComplianceChecks } from '@/hooks/useTenancyAgreements';
import { useToast } from '@/hooks/use-toast';
import { supabase, supabaseAny } from '@/integrations/supabase/client';

export interface RecurringCharge {
  id: string;
  org_id: string;
  tenant_id: string;
  description: string;
  amount: number;
  frequency: string;
  created_at: string;
}

export function useTenantDetailState() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { data: tenant, isLoading } = useTenantV2(id);
  const { data: agreements } = useTenancyAgreements({ tenantId: id });
  const { data: allCompliance } = useTenancyComplianceChecks();
  const updateTenant = useUpdateTenantV2();

  const [showEdit, setShowEdit] = useState(false);
  const [showCreateAgreement, setShowCreateAgreement] = useState(false);
  const [showNotice, setShowNotice] = useState(false);
  const [showEnd, setShowEnd] = useState(false);
  const [charges, setCharges] = useState<RecurringCharge[]>([]);
  const [showAddCharge, setShowAddCharge] = useState(false);
  const [newCharge, setNewCharge] = useState({ description: '', amount: '', frequency: 'monthly' });

  const activeAgreement = useMemo(
    () => agreements?.find(a => a.status === 'active' || a.status === 'notice_period'),
    [agreements],
  );
  const compliance = useMemo(() => allCompliance?.find(c => c.tenant_id === id), [allCompliance, id]);

  useEffect(() => {
    if (!id) return;
    void supabaseAny
      .from('recurring_charges' as never)
      .select('*')
      .eq('tenant_id', id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setCharges(((data as unknown as RecurringCharge[] | null) ?? []));
      });
  }, [id]);

  const addCharge = async () => {
    if (!newCharge.description || !newCharge.amount) return;
    const orgId = (tenant as { org_id?: string | null } | undefined)?.org_id ?? null;
    if (!orgId) return;
    const { data } = await supabaseAny
      .from('recurring_charges' as never)
      .insert({
        org_id: orgId,
        tenant_id: id,
        description: newCharge.description,
        amount: parseFloat(newCharge.amount),
        frequency: newCharge.frequency,
      } as never)
      .select()
      .single();
    const created = data as unknown as RecurringCharge | null;
    if (created) {
      setCharges((prev) => [created, ...prev]);
      setNewCharge({ description: '', amount: '', frequency: 'monthly' });
      setShowAddCharge(false);
    }
  };

  const removeCharge = async (chargeId: string) => {
    await supabase.from('recurring_charges' as never).delete().eq('id', chargeId);
    setCharges((prev) => prev.filter((c) => c.id !== chargeId));
  };

  const handleStatusTransition = (newStatus: string) => {
    if (!id) return;
    updateTenant.mutate(
      { id, status: newStatus as TenantStatusV2 },
      { onSuccess: () => toast({ title: 'Status updated', description: `Tenant status changed to ${newStatus}.` }) },
    );
  };

  return {
    id, tenant, isLoading, agreements, compliance, activeAgreement,
    showEdit, setShowEdit,
    showCreateAgreement, setShowCreateAgreement,
    showNotice, setShowNotice,
    showEnd, setShowEnd,
    charges, showAddCharge, setShowAddCharge, newCharge, setNewCharge,
    addCharge, removeCharge, handleStatusTransition,
    toast,
  };
}

export type TenantDetailState = ReturnType<typeof useTenantDetailState>;
