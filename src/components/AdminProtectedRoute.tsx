import { Navigate } from 'react-router-dom';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';
import { LoadingState } from '@/components/common';

interface AdminProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * Route guard that blocks rendering until platform role resolves,
 * then redirects non-admins to /dashboard.
 * Use inside <ProtectedRoute> for the /admin route.
 */
export function AdminProtectedRoute({ children }: AdminProtectedRouteProps) {
  const { data: role, isLoading } = usePlatformAdmin();
  if (isLoading) return <LoadingState />;
  const isAdmin = role === 'admin' || role === 'super_admin';
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
