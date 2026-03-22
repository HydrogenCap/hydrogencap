import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTenantPortalSession } from '@/hooks/useTenantPortalSession';
import { LoadingState } from '@/components/common/LoadingState';

interface TenantPortalProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: 'rent' | 'documents' | 'maintenance';
}

export function TenantPortalProtectedRoute({ children, requiredPermission }: TenantPortalProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const {
    isLoading,
    isTenantUser,
    canViewRent,
    canViewDocuments,
    canSubmitMaintenance,
  } = useTenantPortalSession();

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingState text="Loading tenant portal..." />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!isTenantUser) {
    return <Navigate to="/dashboard" replace />;
  }

  const hasRequiredPermission =
    requiredPermission === 'rent'
      ? canViewRent
      : requiredPermission === 'documents'
        ? canViewDocuments
        : requiredPermission === 'maintenance'
          ? canSubmitMaintenance
          : true;

  if (!hasRequiredPermission) {
    return <Navigate to="/tenant-portal" replace />;
  }

  return <>{children}</>;
}
