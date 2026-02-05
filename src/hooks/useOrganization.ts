 import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 import { useAuth } from '@/contexts/AuthContext';
 import { useToast } from '@/hooks/use-toast';
 
 export interface Organization {
   id: string;
   name: string;
 }
 
 export function useOrganization() {
   const { user } = useAuth();
   
   return useQuery({
     queryKey: ['organization', user?.id],
     queryFn: async () => {
       if (!user) return null;
       
       // Get user's org via membership
       const { data: membership, error: membershipError } = await supabase
         .from('memberships')
         .select('org_id')
         .eq('user_id', user.id)
         .maybeSingle();
       
       if (membershipError) throw membershipError;
       if (!membership) return null;
       
       const { data, error } = await supabase
         .from('organizations')
         .select('id, name')
         .eq('id', membership.org_id)
         .single();
       
       if (error) throw error;
       return data as Organization;
     },
     enabled: !!user,
   });
 }
 
 export function useUpdateOrganization() {
   const queryClient = useQueryClient();
   const { user } = useAuth();
   const { toast } = useToast();
   
   return useMutation({
     mutationFn: async ({ orgId, name }: { orgId: string; name: string }) => {
       if (!user) throw new Error('Not authenticated');
       
       const { data, error } = await supabase
         .from('organizations')
         .update({
           name,
           updated_at: new Date().toISOString(),
         })
         .eq('id', orgId)
         .select()
         .single();
       
       if (error) throw error;
       return data;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['organization'] });
       toast({ title: 'Organization updated' });
     },
     onError: (error) => {
       toast({ title: 'Failed to update organization', description: error.message, variant: 'destructive' });
     },
   });
 }