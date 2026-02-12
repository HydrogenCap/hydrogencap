import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTenantPortalSession } from '@/hooks/useTenantPortalSession';
import { LoadingState } from '@/components/common/LoadingState';

interface TenantPortalProtectedRouteProps {
  children: React.ReactNode;
}

export function TenantPortalProtectedRoute({ children }: TenantPortalProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { access, isLoading, isTenantUser } = useTenantPortalSession();

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

  return <>{children}</>;
}
