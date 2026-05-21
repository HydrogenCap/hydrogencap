import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseAny } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useAuth } from '@/contexts/AuthContext';
import {
  type SectionKey,
  type SectionVisibility,
  DEFAULT_SECTION_VISIBILITY,
  SECTION_ROUTES,
} from '@/lib/sectionVisibility';

type ProfileSectionVisibility =
  Database['public']['Tables']['profiles']['Update']['section_visibility'];

function mergeSectionVisibility(raw: unknown): SectionVisibility {
  const result = { ...DEFAULT_SECTION_VISIBILITY };
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    for (const key of Object.keys(DEFAULT_SECTION_VISIBILITY)) {
      if (typeof obj[key] === 'boolean') {
        result[key as SectionKey] = obj[key] as boolean;
      }
    }
  }
  return result;
}

export function useSectionVisibility() {
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();

  const { data: visibilitySettings, isLoading } = useQuery({
    queryKey: ['section-visibility', user?.id],
    queryFn: async () => {
      if (!user) return DEFAULT_SECTION_VISIBILITY;
      const { data, error } = await supabaseAny
        .from('profiles')
        .select('section_visibility')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return mergeSectionVisibility(data?.section_visibility);
    },
    enabled: !!user && !loading,
    staleTime: 5 * 60 * 1000,
  });

  const settings = visibilitySettings ?? DEFAULT_SECTION_VISIBILITY;

  const mutation = useMutation({
    mutationFn: async ({ key, value }: { key: SectionKey; value: boolean }) => {
      if (!user) throw new Error('Not authenticated');
      const updated = { ...settings, [key]: value };
      const { error } = await supabaseAny
        .from('profiles')
        .update({ section_visibility: updated as ProfileSectionVisibility, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);
      if (error) throw error;
      return updated;
    },
    onMutate: async ({ key, value }) => {
      await queryClient.cancelQueries({ queryKey: ['section-visibility', user?.id] });
      const previous = queryClient.getQueryData<SectionVisibility>(['section-visibility', user?.id]);
      queryClient.setQueryData(['section-visibility', user?.id], { ...settings, [key]: value });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['section-visibility', user?.id], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['section-visibility', user?.id] });
    },
  });

  const isVisible = (key: SectionKey): boolean => settings[key];

  const updateVisibility = async (key: SectionKey, value: boolean) => {
    await mutation.mutateAsync({ key, value });
  };

  const isRouteHidden = (pathname: string): boolean => {
    for (const [key, routes] of Object.entries(SECTION_ROUTES)) {
      if (routes.some(route => pathname === route || pathname.startsWith(route + '/'))) {
        return !settings[key as SectionKey];
      }
    }
    return false;
  };

  return { isVisible, updateVisibility, visibilitySettings: settings, isLoading, isRouteHidden };
}
