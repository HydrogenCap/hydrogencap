import { useQuery } from '@tanstack/react-query';
import { supabaseAny } from '@/integrations/supabase/client';

export interface OrgMember {
  user_id: string;
  full_name: string | null;
  email: string;
}

/**
 * Returns a lookup map of user_id -> { name, email } for everyone in the
 * caller's organisation(s). Used to render friendly names in the audit log,
 * activity widgets, etc. instead of truncated UUIDs.
 */
export function useOrgMemberLookup() {
  return useQuery({
    queryKey: ['org_member_lookup'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('profiles')
        .select('user_id, full_name, email')
        .limit(500);
      if (error) throw error;
      const map = new Map<string, OrgMember>();
      for (const row of (data || []) as OrgMember[]) {
        map.set(row.user_id, row);
      }
      return map;
    },
  });
}

export function formatMember(map: Map<string, OrgMember> | undefined, userId: string | null | undefined): string {
  if (!userId) return 'System';
  const m = map?.get(userId);
  if (!m) return userId.slice(0, 8);
  return m.full_name || m.email || userId.slice(0, 8);
}
