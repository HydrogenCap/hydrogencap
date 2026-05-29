 import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
 import { supabaseAny } from '@/integrations/supabase/client';
 import { useAuth } from '@/contexts/AuthContext';
import { toast } from "sonner";

 export interface Profile {
   id: string;
   user_id: string;
   email: string | null;
   full_name: string | null;
 }
 
 export function useProfile() {
   const { user } = useAuth();
   
   return useQuery({
     queryKey: ['profile', user?.id],
     queryFn: async () => {
       if (!user) return null;
       
       const { data, error } = await supabaseAny
         .from('profiles')
         .select('*')
         .eq('user_id', user.id)
         .maybeSingle();
       
       if (error) throw error;
       return data as Profile | null;
     },
     enabled: !!user,
   });
 }
 
 export function useUpdateProfile() {
   const queryClient = useQueryClient();
   const { user } = useAuth();
   return useMutation({
     mutationFn: async (updates: { full_name?: string }) => {
       if (!user) throw new Error('Not authenticated');
       
       const { data, error } = await supabaseAny
         .from('profiles')
         .update({
           ...updates,
           updated_at: new Date().toISOString(),
         })
         .eq('user_id', user.id)
         .select()
         .single();
       
       if (error) throw error;
       return data;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['profile'] });
       toast.success('Profile updated');
     },
     onError: (error) => {
       toast.error('Failed to update profile', { description: error.message });
     },
   });
 }