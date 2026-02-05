 import { useMutation } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 import { useToast } from '@/hooks/use-toast';
 
 export function useSendComplianceReminders() {
   const { toast } = useToast();
 
   return useMutation({
     mutationFn: async () => {
       const { data, error } = await supabase.functions.invoke('send-compliance-reminders');
 
       if (error) throw error;
       return data;
     },
     onSuccess: (data) => {
       toast({
         title: 'Reminders sent',
         description: `Processed ${data?.processed || 0} notification(s)`,
       });
     },
     onError: (error) => {
       toast({
         title: 'Failed to send reminders',
         description: error.message,
         variant: 'destructive',
       });
     },
   });
 }