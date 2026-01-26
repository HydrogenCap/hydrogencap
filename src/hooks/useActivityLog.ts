import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type ActivityLog = Database['public']['Tables']['activity_log']['Row'];
type ActivityLogInsert = Database['public']['Tables']['activity_log']['Insert'];

// Entry types for activity logging
export type ActivityEntryType = 
  | 'property_created'
  | 'property_updated'
  | 'valuation_changed'
  | 'mortgage_updated'
  | 'rate_changed'
  | 'income_updated'
  | 'costs_updated'
  | 'document_uploaded'
  | 'document_accepted'
  | 'note_added'
  | 'manual'
  | 'go_live';

async function getUserOrgId(): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc('get_user_org_id');
    
    if (error) {
      console.warn('Failed to get org_id via RPC:', error.message);
      // Fallback to direct query
      const { data: membership, error: membershipError } = await supabase
        .from('memberships')
        .select('org_id')
        .limit(1)
        .maybeSingle();
      
      if (membershipError || !membership) {
        console.warn('Failed to get org_id from memberships:', membershipError?.message);
        return null;
      }
      return membership.org_id;
    }
    
    return data;
  } catch (err) {
    console.error('getUserOrgId error:', err);
    return null;
  }
}

export function useActivityLog(propertyId?: string) {
  return useQuery({
    queryKey: ['activity_log', propertyId],
    queryFn: async () => {
      let query = supabase
        .from('activity_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (propertyId) {
        query = query.eq('property_id', propertyId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ActivityLog[];
    },
  });
}

export function useRecentActivity(limit = 10) {
  return useQuery({
    queryKey: ['activity_log', 'recent', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as ActivityLog[];
    },
  });
}

export function useCreateActivityLog() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (entry: Omit<ActivityLogInsert, 'org_id'>) => {
      const orgId = await getUserOrgId();
      if (!orgId) throw new Error('No organization found');

      const { data, error } = await supabase
        .from('activity_log')
        .insert({ ...entry, org_id: orgId })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['activity_log'] });
      if (data.property_id) {
        queryClient.invalidateQueries({ queryKey: ['activity_log', data.property_id] });
      }
    },
  });
}

// Helper function to log activity (can be used directly)
export async function logActivity(entry: Omit<ActivityLogInsert, 'org_id'>): Promise<ActivityLog> {
  // First check if user is authenticated
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Not authenticated');
  }

  const orgId = await getUserOrgId();
  if (!orgId) {
    throw new Error('No organization found');
  }

  const { data, error } = await supabase
    .from('activity_log')
    .insert({ ...entry, org_id: orgId })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

// Fire-and-forget version for background logging (won't throw errors)
async function logActivitySilent(entry: Omit<ActivityLogInsert, 'org_id'>): Promise<void> {
  try {
    await logActivity(entry);
  } catch (err) {
    console.warn('Activity log failed:', err);
  }
}

// Utility functions for common log entries
export const ActivityLoggers = {
  propertyCreated: (propertyId: string, address: string) =>
    logActivitySilent({
      property_id: propertyId,
      entry_type: 'property_created',
      title: 'Property added',
      body: `Added ${address} to portfolio`,
    }),

  valuationChanged: (propertyId: string, oldValue: number | null, newValue: number) =>
    logActivitySilent({
      property_id: propertyId,
      entry_type: 'valuation_changed',
      title: 'Valuation updated',
      body: oldValue 
        ? `Value changed from £${oldValue.toLocaleString()} to £${newValue.toLocaleString()}`
        : `Initial value set to £${newValue.toLocaleString()}`,
      metadata: { old_value: oldValue, new_value: newValue },
    }),

  mortgageUpdated: (propertyId: string, lender: string | null, balance: number | null) =>
    logActivitySilent({
      property_id: propertyId,
      entry_type: 'mortgage_updated',
      title: 'Mortgage updated',
      body: lender 
        ? `Mortgage with ${lender}${balance ? ` - £${balance.toLocaleString()}` : ''}`
        : `Mortgage balance updated${balance ? ` to £${balance.toLocaleString()}` : ''}`,
      metadata: { lender, balance },
    }),

  rateChanged: (propertyId: string, oldRate: number | null, newRate: number, expiryDate?: string) =>
    logActivitySilent({
      property_id: propertyId,
      entry_type: 'rate_changed',
      title: 'Interest rate changed',
      body: oldRate
        ? `Rate changed from ${oldRate}% to ${newRate}%${expiryDate ? ` (expires ${expiryDate})` : ''}`
        : `Rate set to ${newRate}%${expiryDate ? ` (expires ${expiryDate})` : ''}`,
      metadata: { old_rate: oldRate, new_rate: newRate, expiry_date: expiryDate },
    }),

  incomeUpdated: (propertyId: string, year: number, annualRent: number) =>
    logActivitySilent({
      property_id: propertyId,
      entry_type: 'income_updated',
      title: 'Rental income updated',
      body: `${year} annual rent set to £${annualRent.toLocaleString()}`,
      metadata: { year, annual_rent: annualRent },
    }),

  costsUpdated: (propertyId: string, year: number, totalCosts: number) =>
    logActivitySilent({
      property_id: propertyId,
      entry_type: 'costs_updated',
      title: 'Costs updated',
      body: `${year} total costs: £${totalCosts.toLocaleString()}`,
      metadata: { year, total_costs: totalCosts },
    }),

  documentUploaded: (propertyId: string | null, fileName: string, docType?: string) =>
    logActivitySilent({
      property_id: propertyId,
      entry_type: 'document_uploaded',
      title: 'Document uploaded',
      body: docType ? `${docType}: ${fileName}` : fileName,
      metadata: { file_name: fileName, doc_type: docType },
    }),

  documentAccepted: (propertyId: string | null, fileName: string, docType: string) =>
    logActivitySilent({
      property_id: propertyId,
      entry_type: 'document_accepted',
      title: 'Document filed',
      body: `${docType}: ${fileName}`,
      metadata: { file_name: fileName, doc_type: docType },
    }),

  noteAdded: (propertyId: string, note: string) =>
    logActivity({
      property_id: propertyId,
      entry_type: 'note_added',
      title: 'Note added',
      body: note.length > 100 ? note.substring(0, 100) + '...' : note,
    }),

  goLive: (propertyId: string, address: string) =>
    logActivitySilent({
      property_id: propertyId,
      entry_type: 'go_live',
      title: '🚀 Property activated',
      body: `${address} is now live and income-producing`,
      metadata: { action: 'go_live', activated_at: new Date().toISOString() },
    }),
};
