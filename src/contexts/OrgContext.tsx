import { useMemo, type ReactNode } from 'react';
import {
  useCurrentOrgSelection,
} from '@/hooks/useUserOrg';
import { useUserRole } from '@/hooks/useUserRole';
import { OrgContext, ROLE_PERMISSIONS, type OrgContextType } from './orgContextDefs';

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
