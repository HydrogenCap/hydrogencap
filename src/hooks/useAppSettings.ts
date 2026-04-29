import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseAny } from '@/integrations/supabase/client';
import { fetchUserOrgId, useUserOrg } from './useUserOrg';
import { useToast } from '@/hooks/use-toast';

export type Density = 'cosy' | 'dense';
const DENSITY_KEY = 'ui_density';

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

      const { data, error } = await supabaseAny
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

      const { error } = await supabaseAny
        .from(APP_SETTINGS_TABLE)
        .upsert([{
          org_id: orgId,
          setting_key: key,
          setting_value: value,
          updated_at: new Date().toISOString(),
        }], { onConflict: 'org_id,setting_key' });

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

/**
 * Density preference hook. Persists via the same app_settings mechanism
 * used by other prefs, with a localStorage cache for instant first-paint.
 */
export function useDensity(): Density {
  const { data: settings } = useAppSettings();
  const fromServer = settings?.[DENSITY_KEY] as Density | undefined;
  if (fromServer === 'dense' || fromServer === 'cosy') return fromServer;
  if (typeof window !== 'undefined') {
    const cached = window.localStorage.getItem(DENSITY_KEY);
    if (cached === 'dense' || cached === 'cosy') return cached;
  }
  return 'cosy';
}

export function useSetDensity() {
  const update = useUpdateAppSetting();
  return (value: Density) => {
    if (typeof window !== 'undefined') {
      // localStorage may throw in private mode or when quota is exceeded; safe to ignore — DB write below is the source of truth.
      try { window.localStorage.setItem(DENSITY_KEY, value); } catch { /* non-fatal */ }
    }
    update.mutate({ key: DENSITY_KEY, value });
  };
}
