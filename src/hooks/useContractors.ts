 import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 import { useToast } from '@/hooks/use-toast';
 
 export interface Contractor {
   id: string;
   org_id: string;
   name: string;
   company_name: string | null;
   email: string | null;
   phone: string | null;
   website: string | null;
   compliance_types: string[];
   service_areas: string[];
   notes: string | null;
   is_preferred: boolean;
 }
 
 export function useContractors(complianceType?: string) {
   return useQuery({
     queryKey: ['contractors', complianceType],
     queryFn: async () => {
       let query = supabase
         .from('contractors')
         .select('*')
         .order('is_preferred', { ascending: false })
         .order('name');
       
       if (complianceType) {
         query = query.contains('compliance_types', [complianceType]);
       }
       
       const { data, error } = await query;
       if (error) throw error;
       return data as Contractor[];
     },
   });
 }
 
 export function useCreateContractor() {
   const queryClient = useQueryClient();
   const { toast } = useToast();
   
   return useMutation({
     mutationFn: async (contractor: Omit<Contractor, 'id' | 'org_id'>) => {
       const { data: membership } = await supabase
         .from('memberships')
         .select('org_id')
         .limit(1)
         .single();
       
       const { data, error } = await supabase
         .from('contractors')
         .insert({ ...contractor, org_id: membership!.org_id })
         .select()
         .single();
       
       if (error) throw error;
       return data;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['contractors'] });
       toast({ title: 'Contractor added' });
     },
   });
 }
 
 export function useUpdateContractor() {
   const queryClient = useQueryClient();
   const { toast } = useToast();
   
   return useMutation({
     mutationFn: async ({ id, ...updates }: Partial<Contractor> & { id: string }) => {
       const { data, error } = await supabase
         .from('contractors')
         .update(updates)
         .eq('id', id)
         .select()
         .single();
       
       if (error) throw error;
       return data;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['contractors'] });
       toast({ title: 'Contractor updated' });
     },
   });
 }
 
 export function useDeleteContractor() {
   const queryClient = useQueryClient();
   const { toast } = useToast();
   
   return useMutation({
     mutationFn: async (id: string) => {
       const { error } = await supabase.from('contractors').delete().eq('id', id);
       if (error) throw error;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['contractors'] });
       toast({ title: 'Contractor removed' });
     },
   });
 }