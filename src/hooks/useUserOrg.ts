import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useAuth } from '@/contexts/AuthContext';

type MembershipRow = Database['public']['Tables']['memberships']['Row'];
type OrganizationRow = Database['public']['Tables']['organizations']['Row'];

export interface UserOrganization {
  id: string;
  name: string;
  role: MembershipRow['role'];
  created_at: string;
}

const CURRENT_ORG_STORAGE_KEY = 'tenureiq.current_org_id';
const CURRENT_ORG_EVENT = 'tenureiq:current-org-changed';
const ORG_ROLE_PRIORITY: Record<MembershipRow['role'], number> = {
  owner: 0,
  admin: 1,
  member: 2,
  accountant: 3,
  viewer: 4,
};

function isBrowser() {
  return typeof window !== 'undefined';
}

function getStoredCurrentOrgId() {
  if (!isBrowser()) return null;
  return window.localStorage.getItem(CURRENT_ORG_STORAGE_KEY);
}

function emitCurrentOrgChanged() {
  if (!isBrowser()) return;
  window.dispatchEvent(new Event(CURRENT_ORG_EVENT));
}

export function setCurrentOrgId(orgId: string | null) {
  if (!isBrowser()) return;

  if (orgId) {
    window.localStorage.setItem(CURRENT_ORG_STORAGE_KEY, orgId);
  } else {
    window.localStorage.removeItem(CURRENT_ORG_STORAGE_KEY);
  }

  emitCurrentOrgChanged();
}

function compareOrganizations(a: UserOrganization, b: UserOrganization) {
  const roleCompare = ORG_ROLE_PRIORITY[a.role] - ORG_ROLE_PRIORITY[b.role];
  if (roleCompare !== 0) return roleCompare;

  const createdAtCompare = a.created_at.localeCompare(b.created_at);
  if (createdAtCompare !== 0) return createdAtCompare;

  return a.name.localeCompare(b.name);
}

async function fetchMembershipsForCurrentUser() {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) return [] as MembershipRow[];

  const { data, error } = await supabase
    .from('memberships')
    .select('id, user_id, org_id, role, created_at')
    .eq('user_id', auth.user.id);

  if (error) throw error;
  return (data ?? []) as MembershipRow[];
}

export async function fetchUserOrganizations(): Promise<UserOrganization[]> {
  const memberships = await fetchMembershipsForCurrentUser();
  if (memberships.length === 0) return [];

  const orgIds = [...new Set(memberships.map((membership) => membership.org_id))];
  const { data: organizations, error } = await supabase
    .from('organizations')
    .select('id, name')
    .in('id', orgIds);

  if (error) throw error;

  const organizationMap = new Map(
    ((organizations ?? []) as Pick<OrganizationRow, 'id' | 'name'>[]).map((organization) => [
      organization.id,
      organization.name,
    ])
  );

  return memberships
    .map((membership) => {
      const name = organizationMap.get(membership.org_id);
      if (!name) return null;

      return {
        id: membership.org_id,
        name,
        role: membership.role,
        created_at: membership.created_at,
      } satisfies UserOrganization;
    })
    .filter((organization): organization is UserOrganization => organization !== null)
    .sort(compareOrganizations);
}

function resolvePreferredOrganization(
  organizations: UserOrganization[],
  preferredOrgId?: string | null
) {
  if (preferredOrgId) {
    const matchingOrganization = organizations.find((organization) => organization.id === preferredOrgId);
    if (matchingOrganization) return matchingOrganization;
  }

  return organizations[0] ?? null;
}

async function resolveUserOrgId(preferredOrgId?: string | null) {
  const organizations = await fetchUserOrganizations();
  const resolvedOrganization = resolvePreferredOrganization(
    organizations,
    preferredOrgId ?? getStoredCurrentOrgId()
  );

  if (!resolvedOrganization) {
    throw new Error('No organization found');
  }

  if (getStoredCurrentOrgId() !== resolvedOrganization.id) {
    setCurrentOrgId(resolvedOrganization.id);
  }

  return resolvedOrganization.id;
}

function useStoredCurrentOrgId() {
  const [storedOrgId, setStoredOrgId] = useState<string | null>(() => getStoredCurrentOrgId());

  useEffect(() => {
    if (!isBrowser()) return undefined;

    const syncStoredOrg = () => {
      setStoredOrgId(getStoredCurrentOrgId());
    };

    window.addEventListener('storage', syncStoredOrg);
    window.addEventListener(CURRENT_ORG_EVENT, syncStoredOrg);

    return () => {
      window.removeEventListener('storage', syncStoredOrg);
      window.removeEventListener(CURRENT_ORG_EVENT, syncStoredOrg);
    };
  }, []);

  return storedOrgId;
}

export function useUserOrganizations() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-organizations', user?.id],
    queryFn: fetchUserOrganizations,
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Shared hook to get the current user's org_id.
 * Persists the selected org for multi-org users and falls back deterministically.
 */
export function useUserOrg() {
  const { user } = useAuth();
  const storedOrgId = useStoredCurrentOrgId();

  return useQuery({
    queryKey: ['user-org', user?.id, storedOrgId],
    queryFn: async () => resolveUserOrgId(storedOrgId),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCurrentOrgSelection() {
  const queryClient = useQueryClient();
  const storedOrgId = useStoredCurrentOrgId();
  const organizationsQuery = useUserOrganizations();
  const currentOrganization = resolvePreferredOrganization(organizationsQuery.data ?? [], storedOrgId);

  const selectOrganization = async (orgId: string) => {
    if (orgId === storedOrgId) return;

    setCurrentOrgId(orgId);
    await queryClient.invalidateQueries();
  };

  return {
    ...organizationsQuery,
    currentOrganization,
    currentOrgId: currentOrganization?.id ?? null,
    selectOrganization,
  };
}

/**
 * Imperative helper for use inside mutation functions.
 * Returns string (throws on error). Drop-in replacement for local getUserOrgId().
 */
export async function fetchUserOrgId(preferredOrgId?: string | null): Promise<string> {
  return resolveUserOrgId(preferredOrgId);
}

/**
 * Nullable variant - returns null instead of throwing.
 * Use when the caller handles null explicitly.
 */
export async function fetchUserOrgIdOrNull(preferredOrgId?: string | null): Promise<string | null> {
  try {
    return await resolveUserOrgId(preferredOrgId);
  } catch (err) {
    console.error('Failed to resolve user organization:', err);
    return null;
  }
}
