import { createContext, useContext, useMemo, type ReactNode } from 'react';
import {
  useUserOrganizations,
  useCurrentOrgSelection,
  type UserOrganization,
} from '@/hooks/useUserOrg';
import { useUserRole, type AppRole } from '@/hooks/useUserRole';

// ─── Permission matrix ─────────────────────────────────────────

const ROLE_PERMISSIONS: Record<AppRole, Set<string>> = {
  owner: new Set([
    'read',
    'write',
    'create',
    'delete',
    'read_financials',
    'write_financials',
    'manage_team',
    'manage_settings',
    'delete_org',
  ]),
  admin: new Set([
    'read',
    'write',
    'create',
    'delete',
    'read_financials',
    'write_financials',
    'manage_team',
    'manage_settings',
  ]),
  member: new Set(['read', 'write', 'create']),
  accountant: new Set(['read', 'read_financials', 'write_financials']),
  viewer: new Set(['read']),
};

// ─── Context types ──────────────────────────────────────────────

interface OrgContextType {
  currentOrg: UserOrganization | null;
  orgs: UserOrganization[];
  switchOrg: (orgId: string) => void;
  userRole: AppRole;
  hasPermission: (permission: string) => boolean;
  isLoading: boolean;
}

const OrgContext = createContext<OrgContextType | null>(null);

// ─── Provider ───────────────────────────────────────────────────

export function OrgProvider({ children }: { children: ReactNode }) {
  const {
    data: organizations,
    currentOrganization,
    selectOrganization,
    isLoading: orgsLoading,
  } = useCurrentOrgSelection();

  const { role, isLoading: roleLoading } = useUserRole();

  const value = useMemo<OrgContextType>(() => {
    const permissions = ROLE_PERMISSIONS[role] ?? ROLE_PERMISSIONS.viewer;

    return {
      currentOrg: currentOrganization ?? null,
      orgs: organizations ?? [],
      switchOrg: selectOrganization,
      userRole: role,
      hasPermission: (permission: string) => permissions.has(permission),
      isLoading: orgsLoading || roleLoading,
    };
  }, [currentOrganization, organizations, selectOrganization, role, orgsLoading, roleLoading]);

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

// ─── Hook ───────────────────────────────────────────────────────

export function useOrg() {
  const ctx = useContext(OrgContext);
  if (!ctx) {
    throw new Error('useOrg must be used within an OrgProvider');
  }
  return ctx;
}

export { ROLE_PERMISSIONS };
export type { OrgContextType };
