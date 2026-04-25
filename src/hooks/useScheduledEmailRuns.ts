import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, supabaseAny } from '@/integrations/supabase/client';

interface ScheduledEmailRun {
  id: string;
  run_key: string;
  scheduled_for: string;
  status: 'queued' | 'sent' | 'failed';
  provider_message_id: string | null;
  error: string | null;
  recipient_email: string | null;
  email_subject: string | null;
  created_at: string;
  sent_at: string | null;
}

export function useScheduledEmailRuns(limit = 12) {
  return useQuery({
    queryKey: ['scheduled_email_runs', limit],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('scheduled_email_runs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as ScheduledEmailRun[];
    },
  });
}

export function useSendTestEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('send-weekly-compliance-email', {
        body: { test: true }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled_email_runs'] });
    },
  });
}

export function usePreviewEmail() {
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('send-weekly-compliance-email', {
        body: { preview: true }
      });

      if (error) throw error;
      return data as {
        success: boolean;
        preview: boolean;
        html: string;
        text: string;
        subject: string;
        kpis: {
          activeProperties: number;
          overdueCount: number;
          dueSoonCount: number;
        };
      };
    },
  });
}
