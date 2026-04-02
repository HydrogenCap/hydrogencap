import { type ReactNode } from 'react';
import { useOrg } from '@/contexts/useOrg';

interface PermissionGateProps {
  permission: string;
  fallback?: ReactNode;
  children: ReactNode;
}

export function PermissionGate({ permission, fallback, children }: PermissionGateProps) {
  const { hasPermission } = useOrg();

  if (!hasPermission(permission)) {
    return <>{fallback ?? null}</>;
  }

  return <>{children}</>;
}
