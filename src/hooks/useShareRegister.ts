import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, supabaseAny } from '@/integrations/supabase/client';
import { useEffect } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ShareClass {
  id: string;
  org_id: string;
  entity_id: string;
  class_name: string;
  nominal_value: number;
  total_issued: number;
  voting_rights: boolean;
  dividend_rights: boolean;
  created_at: string;
  updated_at: string;
}

export interface Shareholding {
  id: string;
  org_id: string;
  entity_id: string;
  share_class_id: string;
  holder_name: string;
  holder_type: 'individual' | 'corporate' | 'trust' | 'nominee';
  shares_held: number;
  percentage: number;
  allotment_date: string | null;
  created_at: string;
  updated_at: string;
  share_class?: ShareClass | null;
}

export interface ShareTransfer {
  id: string;
  org_id: string;
  entity_id: string;
  share_class_id: string;
  from_holder: string;
  to_holder: string;
  shares_transferred: number;
  transfer_date: string;
  consideration: number;
  stamp_duty: number;
  notes: string | null;
  created_at: string;
  share_class?: ShareClass | null;
}

export interface BeneficialOwner {
  id: string;
  org_id: string;
  entity_id: string;
  person_name: string;
  nature_of_control: string[];
  verified: boolean;
  psc_register_date: string | null;
  nationality: string | null;
  country_of_residence: string | null;
  date_of_birth: string | null;
  service_address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface EntityDividend {
  id: string;
  org_id: string;
  entity_id: string;
  share_class_id: string;
  declaration_date: string;
  payment_date: string | null;
  amount_per_share: number;
  total_amount: number;
  status: 'declared' | 'approved' | 'paid';
  notes: string | null;
  created_at: string;
  share_class?: ShareClass | null;
}

// ─── Query Keys ──────────────────────────────────────────────────────────────

export const shareRegisterKeys = {
  classes: (entityId: string) => ['share_classes', entityId] as const,
  shareholdings: (entityId: string) => ['shareholdings', entityId] as const,
  transfers: (entityId: string) => ['share_transfers', entityId] as const,
  beneficialOwners: (entityId: string) => ['beneficial_owners', entityId] as const,
  dividends: (entityId: string) => ['entity_dividends', entityId] as const,
};

// ─── Share Classes ───────────────────────────────────────────────────────────

export function useShareClasses(entityId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: shareRegisterKeys.classes(entityId || ''),
    queryFn: async () => {
      if (!entityId) return [];
      const { data, error } = await supabaseAny
        .from('share_classes')
        .select('*')
        .eq('entity_id', entityId)
        .order('class_name');
      if (error) throw error;
      return data as ShareClass[];
    },
    enabled: !!entityId,
  });

  useEffect(() => {
    if (!entityId) return;
    const topic = `entity:${entityId}:share_classes`;
    const channel = supabase
      .channel(topic, { config: { private: true } })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'share_classes', filter: `entity_id=eq.${entityId}` }, () => {
        queryClient.invalidateQueries({ queryKey: shareRegisterKeys.classes(entityId) });
      })
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.warn(`[realtime] channel "${topic}" status=${status}`, err ?? '');
        }
      });
    return () => { supabase.removeChannel(channel); };
  }, [entityId, queryClient]);

  return query;
}

export function useAddShareClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<ShareClass, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabaseAny
        .from('share_classes')
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data as ShareClass;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: shareRegisterKeys.classes(data.entity_id) });
    },
  });
}

// NOTE (Share_classes §0b Ship A — Option α′, 2026-05-10): the V1
// `useUpdateShareClass` and `useDeleteShareClass` hooks were removed here
// because they had zero consumers (the live UI imports the V2 equivalents
// from `useCompanies` / `useShareCapital`). The remaining V1 writer in this
// file — `useAddShareClass` above + its sole consumer `AddShareClassDialog`
// (ShareRegister.tsx) — is intentionally retained until Ship C, where the
// V1 write, V1 read (`useShareClasses`), and V1 realtime channel can flip
// to `share_classes_v2` atomically. Swapping the write alone would route
// inserts to V2 while the list still reads V1 + watches V1 realtime,
// producing a UX-silent duplicate-insert regression.

// ─── Shareholdings ───────────────────────────────────────────────────────────

export function useShareholdings(entityId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: shareRegisterKeys.shareholdings(entityId || ''),
    queryFn: async () => {
      if (!entityId) return [];
      const { data, error } = await supabaseAny
        .from('shareholdings')
        .select('*, share_class:share_classes(*)')
        .eq('entity_id', entityId)
        .order('percentage', { ascending: false });
      if (error) throw error;
      return data as Shareholding[];
    },
    enabled: !!entityId,
  });

  useEffect(() => {
    if (!entityId) return;
    const topic = `entity:${entityId}:shareholdings`;
    const channel = supabase
      .channel(topic, { config: { private: true } })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shareholdings', filter: `entity_id=eq.${entityId}` }, () => {
        queryClient.invalidateQueries({ queryKey: shareRegisterKeys.shareholdings(entityId) });
      })
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.warn(`[realtime] channel "${topic}" status=${status}`, err ?? '');
        }
      });
    return () => { supabase.removeChannel(channel); };
  }, [entityId, queryClient]);

  return query;
}

export function useAddShareholding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<Shareholding, 'id' | 'created_at' | 'updated_at' | 'share_class'>) => {
      const { data, error } = await supabaseAny
        .from('shareholdings')
        .insert(input)
        .select('*, share_class:share_classes(*)')
        .single();
      if (error) throw error;
      return data as Shareholding;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: shareRegisterKeys.shareholdings(data.entity_id) });
    },
  });
}

export function useUpdateShareholding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Shareholding> & { id: string; entity_id: string }) => {
      const { share_class: _share_class, ...rest } = updates as Partial<Shareholding> & { share_class?: unknown };
      const { data, error } = await supabaseAny
        .from('shareholdings')
        .update(rest)
        .eq('id', id)
        .select('*, share_class:share_classes(*)')
        .single();
      if (error) throw error;
      return data as Shareholding;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: shareRegisterKeys.shareholdings(data.entity_id) });
    },
  });
}

export function useDeleteShareholding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, entityId }: { id: string; entityId: string }) => {
      const { error } = await supabaseAny
        .from('shareholdings')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return { entityId };
    },
    onSuccess: ({ entityId }) => {
      queryClient.invalidateQueries({ queryKey: shareRegisterKeys.shareholdings(entityId) });
    },
  });
}

// ─── Share Transfers ─────────────────────────────────────────────────────────

export function useShareTransfers(entityId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: shareRegisterKeys.transfers(entityId || ''),
    queryFn: async () => {
      if (!entityId) return [];
      const { data, error } = await supabaseAny
        .from('share_transfers')
        .select('*, share_class:share_classes(*)')
        .eq('entity_id', entityId)
        .order('transfer_date', { ascending: false });
      if (error) throw error;
      return data as ShareTransfer[];
    },
    enabled: !!entityId,
  });

  useEffect(() => {
    if (!entityId) return;
    const topic = `entity:${entityId}:share_transfers`;
    const channel = supabase
      .channel(topic, { config: { private: true } })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'share_transfers', filter: `entity_id=eq.${entityId}` }, () => {
        queryClient.invalidateQueries({ queryKey: shareRegisterKeys.transfers(entityId) });
      })
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.warn(`[realtime] channel "${topic}" status=${status}`, err ?? '');
        }
      });
    return () => { supabase.removeChannel(channel); };
  }, [entityId, queryClient]);

  return query;
}

export function useAddShareTransfer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<ShareTransfer, 'id' | 'created_at' | 'share_class'>) => {
      const { data, error } = await supabaseAny
        .from('share_transfers')
        .insert(input)
        .select('*, share_class:share_classes(*)')
        .single();
      if (error) throw error;
      return data as ShareTransfer;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: shareRegisterKeys.transfers(data.entity_id) });
      queryClient.invalidateQueries({ queryKey: shareRegisterKeys.shareholdings(data.entity_id) });
    },
  });
}

// ─── Beneficial Owners ───────────────────────────────────────────────────────

export function useBeneficialOwnersPSC(entityId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: shareRegisterKeys.beneficialOwners(entityId || ''),
    queryFn: async () => {
      if (!entityId) return [];
      const { data, error } = await supabaseAny
        .from('beneficial_owners')
        .select('*')
        .eq('entity_id', entityId)
        .order('person_name');
      if (error) throw error;
      return data as BeneficialOwner[];
    },
    enabled: !!entityId,
  });

  useEffect(() => {
    if (!entityId) return;
    const channel = supabase
      .channel(`beneficial_owners_${entityId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'beneficial_owners', filter: `entity_id=eq.${entityId}` }, () => {
        queryClient.invalidateQueries({ queryKey: shareRegisterKeys.beneficialOwners(entityId) });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [entityId, queryClient]);

  return query;
}

export function useAddBeneficialOwnerPSC() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<BeneficialOwner, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabaseAny
        .from('beneficial_owners')
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data as BeneficialOwner;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: shareRegisterKeys.beneficialOwners(data.entity_id) });
    },
  });
}

export function useUpdateBeneficialOwnerPSC() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<BeneficialOwner> & { id: string; entity_id: string }) => {
      const { data, error } = await supabaseAny
        .from('beneficial_owners')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as BeneficialOwner;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: shareRegisterKeys.beneficialOwners(data.entity_id) });
    },
  });
}

export function useDeleteBeneficialOwnerPSC() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, entityId }: { id: string; entityId: string }) => {
      const { error } = await supabaseAny
        .from('beneficial_owners')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return { entityId };
    },
    onSuccess: ({ entityId }) => {
      queryClient.invalidateQueries({ queryKey: shareRegisterKeys.beneficialOwners(entityId) });
    },
  });
}

// ─── Dividends ───────────────────────────────────────────────────────────────

export function useEntityDividends(entityId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: shareRegisterKeys.dividends(entityId || ''),
    queryFn: async () => {
      if (!entityId) return [];
      const { data, error } = await supabaseAny
        .from('entity_dividends')
        .select('*, share_class:share_classes(*)')
        .eq('entity_id', entityId)
        .order('declaration_date', { ascending: false });
      if (error) throw error;
      return data as EntityDividend[];
    },
    enabled: !!entityId,
  });

  useEffect(() => {
    if (!entityId) return;
    const channel = supabase
      .channel(`entity_dividends_${entityId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'entity_dividends', filter: `entity_id=eq.${entityId}` }, () => {
        queryClient.invalidateQueries({ queryKey: shareRegisterKeys.dividends(entityId) });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [entityId, queryClient]);

  return query;
}

export function useAddEntityDividend() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<EntityDividend, 'id' | 'created_at' | 'share_class'>) => {
      const { data, error } = await supabaseAny
        .from('entity_dividends')
        .insert(input)
        .select('*, share_class:share_classes(*)')
        .single();
      if (error) throw error;
      return data as EntityDividend;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: shareRegisterKeys.dividends(data.entity_id) });
    },
  });
}

export function useUpdateEntityDividend() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<EntityDividend> & { id: string; entity_id: string }) => {
      const { share_class: _share_class, ...rest } = updates as Partial<Shareholding> & { share_class?: unknown };
      const { data, error } = await supabaseAny
        .from('entity_dividends')
        .update(rest)
        .eq('id', id)
        .select('*, share_class:share_classes(*)')
        .single();
      if (error) throw error;
      return data as EntityDividend;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: shareRegisterKeys.dividends(data.entity_id) });
    },
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function calculateStampDuty(consideration: number): number {
  if (consideration <= 1000) return 0;
  return Math.ceil(consideration * 0.005 * 100) / 100;
}

export { formatCurrency } from '@/lib/calculations';
