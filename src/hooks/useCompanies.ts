import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type CompanyStatus = 'ACTIVE' | 'DORMANT' | 'SOLD' | 'CLOSED';
export type CompanyType = 'HOLDCO' | 'SPV' | 'OPCO' | 'OTHER';

export interface Company {
  id: string;
  org_id: string;
  party_id: string;
  legal_name: string;
  trading_name: string | null;
  company_number: string | null;
  jurisdiction: string;
  status: CompanyStatus;
  company_type: CompanyType;
  ch_registered_address: string | null;
  ch_incorporation_date: string | null;
  ch_last_synced_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  party?: {
    id: string;
    display_name: string;
    party_type: string;
  };
}

export interface ShareClass {
  id: string;
  company_id: string;
  name: string;
  currency: string | null;
  is_primary: boolean;
  issued_shares: number;
  nominal_value: number | null;
  created_at: string;
  updated_at: string;
}

export interface Shareholding {
  id: string;
  company_id: string;
  share_class_id: string;
  shareholder_party_id: string;
  shares_held: number;
  ownership_source: 'MANUAL' | 'COMPANIES_HOUSE' | 'IMPORT';
  effective_from: string | null;
  effective_to: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  share_class?: ShareClass;
  shareholder_party?: {
    id: string;
    display_name: string;
    party_type: string;
    company_number: string | null;
  };
}

export interface CompanyWithDetails extends Company {
  share_classes: ShareClass[];
  shareholdings: (Shareholding & { 
    share_class: ShareClass;
    shareholder_party: {
      id: string;
      display_name: string;
      party_type: string;
      company_number: string | null;
    };
  })[];
}

async function getUserOrgId(): Promise<string> {
  const { data, error } = await supabase
    .from('memberships')
    .select('org_id')
    .limit(1)
    .maybeSingle();
  
  if (error || !data) throw new Error('No organization found');
  return data.org_id;
}

export function useCompanies() {
  return useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select(`
          *,
          party:parties(id, display_name, party_type)
        `)
        .order('legal_name');

      if (error) throw error;
      return data as Company[];
    },
  });
}

export function useCompany(companyId: string | undefined) {
  return useQuery({
    queryKey: ['companies', companyId],
    queryFn: async () => {
      if (!companyId) return null;
      
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .select(`
          *,
          party:parties(id, display_name, party_type)
        `)
        .eq('id', companyId)
        .single();

      if (companyError) throw companyError;

      // Get share classes
      const { data: shareClasses, error: scError } = await supabase
        .from('share_classes')
        .select('*')
        .eq('company_id', companyId)
        .order('is_primary', { ascending: false });

      if (scError) throw scError;

      // Get shareholdings with party details
      const { data: shareholdings, error: shError } = await supabase
        .from('shareholdings')
        .select(`
          *,
          share_class:share_classes(*),
          shareholder_party:parties(id, display_name, party_type, company_number)
        `)
        .eq('company_id', companyId)
        .is('effective_to', null)
        .order('shares_held', { ascending: false });

      if (shError) throw shError;

      return {
        ...company,
        share_classes: shareClasses || [],
        shareholdings: shareholdings || [],
      } as CompanyWithDetails;
    },
    enabled: !!companyId,
  });
}

export function useCreateCompany() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: {
      legal_name: string;
      trading_name?: string;
      company_number?: string;
      company_type: CompanyType;
      jurisdiction?: string;
      ch_registered_address?: string;
      ch_incorporation_date?: string;
    }) => {
      const orgId = await getUserOrgId();

      // First create the party
      const { data: party, error: partyError } = await supabase
        .from('parties')
        .insert({
          org_id: orgId,
          party_type: 'COMPANY',
          display_name: input.trading_name || input.legal_name,
          legal_name: input.legal_name,
          company_number: input.company_number,
        })
        .select()
        .single();

      if (partyError) throw partyError;

      // Then create the company
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .insert({
          org_id: orgId,
          party_id: party.id,
          legal_name: input.legal_name,
          trading_name: input.trading_name,
          company_number: input.company_number,
          company_type: input.company_type,
          jurisdiction: input.jurisdiction || 'UK',
          ch_registered_address: input.ch_registered_address,
          ch_incorporation_date: input.ch_incorporation_date,
        })
        .select()
        .single();

      if (companyError) throw companyError;

      // Create default share class
      const { error: scError } = await supabase
        .from('share_classes')
        .insert({
          company_id: company.id,
          name: 'Ordinary',
          issued_shares: 100,
          is_primary: true,
        });

      if (scError) throw scError;

      return company as Company;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['parties'] });
    },
  });
}

export function useUpdateCompany() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...company }: Partial<Company> & { id: string }) => {
      const { data, error } = await supabase
        .from('companies')
        .update(company)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Company;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['companies', data.id] });
    },
  });
}

export function useDeleteCompany() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      // Get the party_id first
      const { data: company } = await supabase
        .from('companies')
        .select('party_id')
        .eq('id', id)
        .single();

      // Delete company (cascades to share_classes and shareholdings)
      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Delete the party too
      if (company?.party_id) {
        await supabase
          .from('parties')
          .delete()
          .eq('id', company.party_id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['parties'] });
    },
  });
}

// Share Class mutations
export function useCreateShareClass() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: {
      company_id: string;
      name: string;
      issued_shares: number;
      currency?: string;
      nominal_value?: number;
    }) => {
      const { data, error } = await supabase
        .from('share_classes')
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return data as ShareClass;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['companies', data.company_id] });
    },
  });
}

export function useUpdateShareClass() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...shareClass }: Partial<ShareClass> & { id: string }) => {
      const { data, error } = await supabase
        .from('share_classes')
        .update(shareClass)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as ShareClass;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['companies', data.company_id] });
    },
  });
}

// Shareholding mutations
export function useAddShareholding() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: {
      company_id: string;
      share_class_id: string;
      shareholder_party_id: string;
      shares_held: number;
      ownership_source?: 'MANUAL' | 'COMPANIES_HOUSE' | 'IMPORT';
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from('shareholdings')
        .insert({
          ...input,
          ownership_source: input.ownership_source || 'MANUAL',
        })
        .select(`
          *,
          share_class:share_classes(*),
          shareholder_party:parties(id, display_name, party_type, company_number)
        `)
        .single();

      if (error) throw error;
      return data as Shareholding;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['companies', data.company_id] });
    },
  });
}

export function useUpdateShareholding() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, companyId, ...shareholding }: Partial<Shareholding> & { id: string; companyId: string }) => {
      const { data, error } = await supabase
        .from('shareholdings')
        .update(shareholding)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { ...data, company_id: companyId } as Shareholding;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['companies', data.company_id] });
    },
  });
}

export function useDeleteShareholding() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, companyId }: { id: string; companyId: string }) => {
      const { error } = await supabase
        .from('shareholdings')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { companyId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['companies', data.companyId] });
    },
  });
}
