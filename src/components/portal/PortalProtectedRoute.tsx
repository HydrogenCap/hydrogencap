import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useShareholderSession } from '@/hooks/useShareholderSession';

interface PortalProtectedRouteProps {
  children: React.ReactNode;
}

export function PortalProtectedRoute({ children }: PortalProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { access, isLoading: accessLoading, isShareholderUser } = useShareholderSession();

  // Show loading while checking auth and access
  if (authLoading || accessLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Redirect to auth if not logged in
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Redirect to main dashboard if user is not a shareholder
  // (they might be a regular org member)
  if (!isShareholderUser) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
