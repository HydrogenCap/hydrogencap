import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Shared hook to get the current user's org_id.
 * Caches the result for 5 minutes to avoid redundant queries.
 */
export function useUserOrg() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['user-org', user?.id],
    queryFn: async () => {
      const orgId = await fetchUserOrgId();
      return orgId;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Imperative helper for use inside mutation functions.
 * Returns string (throws on error). Drop-in replacement for local getUserOrgId().
 */
export async function fetchUserOrgId(): Promise<string> {
  const { data, error } = await supabase
    .from('memberships')
    .select('org_id')
    .limit(1)
    .maybeSingle();
  if (error || !data) throw new Error('No organization found');
  return data.org_id;
}

/**
 * Nullable variant — returns null instead of throwing.
 * Use when the caller handles null explicitly.
 */
export async function fetchUserOrgIdOrNull(): Promise<string | null> {
  const { data, error } = await supabase
    .from('memberships')
    .select('org_id')
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data.org_id;
}
