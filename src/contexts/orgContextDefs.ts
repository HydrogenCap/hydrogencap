import { createContext } from 'react';
import type { UserOrganization } from '@/hooks/useUserOrg';
import type { AppRole } from '@/hooks/useUserRole';

// ─── Permission matrix ─────────────────────────────────────────

export const ROLE_PERMISSIONS: Record<AppRole, Set<string>> = {
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

export interface OrgContextType {
  currentOrg: UserOrganization | null;
  orgs: UserOrganization[];
  switchOrg: (orgId: string) => void;
  userRole: AppRole;
  hasPermission: (permission: string) => boolean;
  isLoading: boolean;
}

export const OrgContext = createContext<OrgContextType | null>(null);
