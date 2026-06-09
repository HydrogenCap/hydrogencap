import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseAny } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { fetchUserOrgId, useUserOrg } from '@/hooks/useUserOrg';
import { toast } from "sonner";

 export interface NotificationPreferences {
   id: string;
   user_id: string;
   org_id: string;
   email_enabled: boolean;
   email_address: string | null;
   reminder_days: number[];
   weekly_digest_enabled: boolean;
   weekly_digest_day: number;
   notify_expired: boolean;
   notify_expiring_soon: boolean;
   notify_rate_expiry: boolean;
   notify_negative_cashflow: boolean;
   notify_rent_collection: boolean;
   notify_voids: boolean;
   notify_regulatory_changes: boolean;
   notify_recommended_actions: boolean;
   timezone: string;
 }
 
export function useNotificationPreferences() {
  const { user } = useAuth();
  const { data: orgId } = useUserOrg();
  
  return useQuery({
    queryKey: ['notification-preferences', user?.id, orgId],
    queryFn: async () => {
      if (!user || !orgId) return null;
      
      const { data, error } = await supabaseAny
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .eq('org_id', orgId)
        .maybeSingle();
       
       if (error) throw error;
       return data as NotificationPreferences | null;
     },
    enabled: !!user && !!orgId,
  });
}
 
 export function useUpdateNotificationPreferences() {
   const queryClient = useQueryClient();
   const { user } = useAuth();
   return useMutation({
    mutationFn: async (prefs: Partial<NotificationPreferences>) => {
      if (!user) throw new Error('Not authenticated');

      const orgId = await fetchUserOrgId();
      
      const { data, error } = await supabaseAny
        .from('notification_preferences')
        .upsert({
          user_id: user.id,
          org_id: orgId,
          ...prefs,
          updated_at: new Date().toISOString(),
         }, {
           onConflict: 'user_id,org_id',
         })
         .select()
         .single();
       
       if (error) throw error;
       return data;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
       toast.success('Preferences saved');
     },
     onError: (error) => {
       toast.error('Failed to save', { description: error.message });
     },
   });
 }
