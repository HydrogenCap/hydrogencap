 import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 import { fetchUserOrgId as getUserOrgId } from './useUserOrg';
 import { useToast } from '@/hooks/use-toast';
 
 export type TenantStatus = 'prospect' | 'active' | 'past' | 'blacklisted';
 export type TenantType = 'individual' | 'company';
 
 export interface Tenant {
   id: string;
   org_id: string;
   tenant_type: TenantType;
   first_name: string | null;
   last_name: string | null;
   email: string | null;
   phone: string | null;
   date_of_birth: string | null;
   national_insurance: string | null;
   emergency_contact_name: string | null;
   emergency_contact_phone: string | null;
   emergency_contact_relationship: string | null;
   employment_status: string | null;
   employer_name: string | null;
   employer_address: string | null;
   annual_income: number | null;
   guarantor_name: string | null;
   guarantor_email: string | null;
   guarantor_phone: string | null;
   guarantor_address: string | null;
   previous_address: string | null;
   previous_landlord_name: string | null;
   previous_landlord_phone: string | null;
   reference_notes: string | null;
   portal_user_id: string | null;
   company_name: string | null;
   company_number: string | null;
   company_registered_address: string | null;
   company_contact_name: string | null;
   company_contact_email: string | null;
   company_contact_phone: string | null;
   company_contact_role: string | null;
   trading_name: string | null;
   vat_registered: boolean | null;
  vat_number: string | null;
  compliance_contact_name: string | null;
  compliance_contact_email: string | null;
  status: TenantStatus;
   notes: string | null;
   created_at: string;
   updated_at: string;
 }
 
export interface TenantWithProperty extends Tenant {
  current_tenancies: {
    id: string;
    property_id: string;
    room_id: string;
    start_date: string;
    end_date: string | null;
    rent_amount_pcm: number;
    status: string;
    property?: {
      address_line: string;
      postcode: string | null;
    };
    room?: {
      room_name: string;
    };
  }[];
  total_rent_pcm: number;
}
 
// getUserOrgId replaced by shared import
 
 export function useTenants(status?: TenantStatus) {
   return useQuery({
     queryKey: ['tenants', status],
     queryFn: async () => {
        let query = supabase
          .from('tenants')
          .select('id, org_id, tenant_type, first_name, last_name, email, phone, company_name, company_number, status, notes, created_at, updated_at')
          .order('created_at', { ascending: false });
 
       if (status) {
         query = query.eq('status', status);
       }
 
       const { data, error } = await query;
       if (error) throw error;
       return data as Tenant[];
     },
   });
 }
 
 export function useTenantsWithProperty() {
   return useQuery({
     queryKey: ['tenants', 'with-property'],
     queryFn: async () => {
       // Get all tenants
        const { data: tenants, error: tenantsError } = await supabase
          .from('tenants')
          .select('*')
          .order('created_at', { ascending: false });
 
       if (tenantsError) throw tenantsError;
 
       // Get active tenancies with property and room info
      const { data: tenancies, error: tenanciesError } = await supabase
        .from('tenancies')
        .select(`
          id, tenant_id, property_id, room_id, start_date, end_date, rent_amount_pcm, status,
          property:properties(address_line, town_city, postcode),
          room:rooms(room_name)
        `)
        .in('status', ['active', 'notice']);

      if (tenanciesError) throw tenanciesError;

      // Group tenancies by tenant_id (supports multiple per tenant)
      const tenancyMap = new Map<string, typeof tenancies>();
      for (const t of tenancies) {
        const existing = tenancyMap.get(t.tenant_id) || [];
        existing.push(t);
        tenancyMap.set(t.tenant_id, existing);
      }

      return tenants.map(tenant => {
        const tenantTenancies = tenancyMap.get(tenant.id) || [];
        return {
          ...tenant,
          current_tenancies: tenantTenancies,
          total_rent_pcm: tenantTenancies.reduce((sum, t) => sum + (t.rent_amount_pcm || 0), 0),
        };
      }) as TenantWithProperty[];
    },
  });
}
 
 export function useTenant(tenantId: string) {
   return useQuery({
     queryKey: ['tenants', tenantId],
     queryFn: async () => {
       const { data, error } = await supabase
         .from('tenants')
         .select('*')
         .eq('id', tenantId)
         .single();
       if (error) throw error;
       return data as Tenant;
     },
     enabled: !!tenantId,
   });
 }
 
 export function useCreateTenant() {
   const queryClient = useQueryClient();
   const { toast } = useToast();
 
   return useMutation({
     mutationFn: async (tenant: Omit<Tenant, 'id' | 'org_id' | 'created_at' | 'updated_at'>) => {
       const orgId = await getUserOrgId();
       if (!orgId) throw new Error('No organization found');
 
       const { data, error } = await supabase
         .from('tenants')
         .insert({ ...tenant, org_id: orgId })
         .select()
         .single();
 
       if (error) throw error;
       return data;
     },
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: ['tenants'] });
        const displayName = data.tenant_type === 'company' 
          ? data.company_name 
          : `${data.first_name} ${data.last_name}`;
        toast({ title: 'Tenant created', description: `${displayName} has been added.` });
      },
     onError: (error) => {
       toast({ title: 'Failed to create tenant', description: error.message, variant: 'destructive' });
     },
   });
 }
 
 export function useUpdateTenant() {
   const queryClient = useQueryClient();
   const { toast } = useToast();
 
   return useMutation({
     mutationFn: async ({ id, ...updates }: Partial<Tenant> & { id: string }) => {
       const { data, error } = await supabase
         .from('tenants')
         .update(updates)
         .eq('id', id)
         .select()
         .single();
 
       if (error) throw error;
       return data;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['tenants'] });
       toast({ title: 'Tenant updated' });
     },
     onError: (error) => {
       toast({ title: 'Failed to update tenant', description: error.message, variant: 'destructive' });
     },
   });
 }
 
 export function useDeleteTenant() {
   const queryClient = useQueryClient();
   const { toast } = useToast();
 
   return useMutation({
     mutationFn: async (id: string) => {
       const { error } = await supabase.from('tenants').delete().eq('id', id);
       if (error) throw error;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['tenants'] });
       toast({ title: 'Tenant deleted' });
     },
     onError: (error) => {
       toast({ title: 'Failed to delete tenant', description: error.message, variant: 'destructive' });
     },
   });
 }
 
 export function useTenantStats() {
   const { data: tenants } = useTenants();
 
   if (!tenants) return null;
 
   return {
     total: tenants.length,
     prospect: tenants.filter(t => t.status === 'prospect').length,
     active: tenants.filter(t => t.status === 'active').length,
     past: tenants.filter(t => t.status === 'past').length,
     blacklisted: tenants.filter(t => t.status === 'blacklisted').length,
   };
 }