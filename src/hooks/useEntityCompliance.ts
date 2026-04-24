import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, supabaseAny } from '@/integrations/supabase/client';

// ── Types ──────────────────────────────────────────────────

export type FilingType = 'confirmation_statement' | 'annual_accounts' | 'ct600' | 'vat_return';
export type FilingStatus = 'upcoming' | 'overdue' | 'filed';

export interface CompanyFilingDeadline {
  id: string;
  entity_id: string;
  org_id: string;
  filing_type: FilingType;
  due_date: string;
  filed_date: string | null;
  status: FilingStatus;
  reference: string | null;
  document_url: string | null;
  created_at: string;
  updated_at: string;
}

export type OfficerRole = 'director' | 'secretary' | 'psc';

export interface DirectorAppointment {
  id: string;
  entity_id: string;
  org_id: string;
  person_name: string;
  role: OfficerRole;
  appointed_date: string;
  resigned_date: string | null;
  companies_house_id: string | null;
  nature_of_control: string | null;
  created_at: string;
  updated_at: string;
}

export type LoanStatus = 'active' | 'repaid' | 'written_off';

export interface IntercompanyLoan {
  id: string;
  org_id: string;
  lender_entity_id: string;
  borrower_entity_id: string;
  principal: number;
  interest_rate: number;
  start_date: string;
  maturity_date: string | null;
  outstanding_balance: number;
  interest_accrued: number;
  status: LoanStatus;
  created_at: string;
  updated_at: string;
}

// ── Filing Deadlines ───────────────────────────────────────

export function useFilingDeadlines(entityId: string | undefined) {
  return useQuery({
    queryKey: ['filing_deadlines', entityId],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('company_filing_deadlines')
        .select('*')
        .eq('entity_id', entityId!)
        .order('due_date', { ascending: true });
      if (error) throw error;
      return data as CompanyFilingDeadline[];
    },
    enabled: !!entityId,
  });
}

export function useCreateFilingDeadline() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (filing: Omit<CompanyFilingDeadline, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabaseAny
        .from('company_filing_deadlines')
        .insert(filing)
        .select()
        .single();
      if (error) throw error;
      return data as CompanyFilingDeadline;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['filing_deadlines', data.entity_id] });
    },
  });
}

export function useUpdateFilingDeadline() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CompanyFilingDeadline> & { id: string }) => {
      const { data, error } = await supabaseAny
        .from('company_filing_deadlines')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as CompanyFilingDeadline;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['filing_deadlines', data.entity_id] });
    },
  });
}

export function useDeleteFilingDeadline() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, entityId }: { id: string; entityId: string }) => {
      const { error } = await supabase.from('company_filing_deadlines' as any).delete().eq('id', id);
      if (error) throw error;
      return entityId;
    },
    onSuccess: (entityId) => {
      queryClient.invalidateQueries({ queryKey: ['filing_deadlines', entityId] });
    },
  });
}

// ── Director Appointments ──────────────────────────────────

export function useDirectorAppointments(entityId: string | undefined) {
  return useQuery({
    queryKey: ['director_appointments', entityId],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('director_appointments')
        .select('*')
        .eq('entity_id', entityId!)
        .order('appointed_date', { ascending: false });
      if (error) throw error;
      return data as DirectorAppointment[];
    },
    enabled: !!entityId,
  });
}

export function useCreateDirectorAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (appointment: Omit<DirectorAppointment, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabaseAny
        .from('director_appointments')
        .insert(appointment)
        .select()
        .single();
      if (error) throw error;
      return data as DirectorAppointment;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['director_appointments', data.entity_id] });
    },
  });
}

export function useUpdateDirectorAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<DirectorAppointment> & { id: string }) => {
      const { data, error } = await supabaseAny
        .from('director_appointments')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as DirectorAppointment;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['director_appointments', data.entity_id] });
    },
  });
}

export function useDeleteDirectorAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, entityId }: { id: string; entityId: string }) => {
      const { error } = await supabase.from('director_appointments' as any).delete().eq('id', id);
      if (error) throw error;
      return entityId;
    },
    onSuccess: (entityId) => {
      queryClient.invalidateQueries({ queryKey: ['director_appointments', entityId] });
    },
  });
}

// ── Intercompany Loans ─────────────────────────────────────

export function useIntercompanyLoans(entityId: string | undefined) {
  return useQuery({
    queryKey: ['intercompany_loans', entityId],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('intercompany_loans')
        .select('*')
        .or(`lender_entity_id.eq.${entityId!},borrower_entity_id.eq.${entityId!}`);
      if (error) throw error;
      return data as IntercompanyLoan[];
    },
    enabled: !!entityId,
  });
}

export function useCreateIntercompanyLoan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (loan: Omit<IntercompanyLoan, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabaseAny
        .from('intercompany_loans')
        .insert(loan)
        .select()
        .single();
      if (error) throw error;
      return data as IntercompanyLoan;
    },
    onSuccess: (_data) => {
      queryClient.invalidateQueries({ queryKey: ['intercompany_loans'] });
    },
  });
}

export function useUpdateIntercompanyLoan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<IntercompanyLoan> & { id: string }) => {
      const { data, error } = await supabaseAny
        .from('intercompany_loans')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as IntercompanyLoan;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intercompany_loans'] });
    },
  });
}

export function useDeleteIntercompanyLoan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('intercompany_loans' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intercompany_loans'] });
    },
  });
}
