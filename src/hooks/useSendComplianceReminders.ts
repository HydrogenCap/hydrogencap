 import { useMutation } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
import { toast } from "sonner";

 export function useSendComplianceReminders() {
   return useMutation({
     mutationFn: async () => {
       const { data, error } = await supabase.functions.invoke('send-compliance-reminders');
 
       if (error) throw error;
       return data;
     },
     onSuccess: (data) => {
       toast.success('Reminders sent', { description: `Processed ${data?.processed || 0} notification(s)` });
     },
     onError: (error) => {
       toast.error('Failed to send reminders', { description: error.message });
     },
   });
 }