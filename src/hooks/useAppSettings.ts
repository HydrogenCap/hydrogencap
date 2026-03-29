import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { fetchUserOrgId, useUserOrg } from './useUserOrg';
import { useToast } from '@/hooks/use-toast';

interface AppSettingRow {
  setting_key: string;
  setting_value: string;
}

const APP_SETTINGS_TABLE = 'app_settings' as never;

export function useAppSettings() {
  const { data: orgId } = useUserOrg();

  return useQuery({
    queryKey: ['app-settings', orgId],
    queryFn: async () => {
      if (!orgId) throw new Error('No org');

      const { data, error } = await supabase
        .from(APP_SETTINGS_TABLE)
        .select('*')
        .eq('org_id', orgId);

      if (error) throw error;
      const settings: Record<string, string> = {};
      for (const row of (data || []) as AppSettingRow[]) {
        settings[row.setting_key] = row.setting_value;
      }
      return settings;
    },
    enabled: !!orgId,
  });
}

export function useUpdateAppSetting() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const orgId = await fetchUserOrgId();
      if (!orgId) throw new Error('No org');

      const { error } = await supabase
        .from(APP_SETTINGS_TABLE)
        .upsert([{
          org_id: orgId,
          setting_key: key,
          setting_value: value,
          updated_at: new Date().toISOString(),
        }] satisfies Database['public']['Tables']['app_settings']['Insert'][], { onConflict: 'org_id,setting_key' });

      if (error) throw error;
    },
    onSuccess: async () => {
      const orgId = await fetchUserOrgId();
      queryClient.invalidateQueries({ queryKey: ['app-settings', orgId] });
      toast({ title: 'Setting saved' });
    },
    onError: (err) => {
      toast({
        title: 'Failed to save setting',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    },
  });
}
