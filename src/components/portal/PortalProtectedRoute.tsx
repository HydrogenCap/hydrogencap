import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useShareholderSession } from '@/hooks/useShareholderSession';
import { usePortalInvestorData } from '@/hooks/usePortalInvestorData';

interface PortalProtectedRouteProps {
  children: React.ReactNode;
}

export function PortalProtectedRoute({ children }: PortalProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { access, isLoading: accessLoading, isShareholderUser } = useShareholderSession();
  const { isInvestorUser, isLoading: investorLoading } = usePortalInvestorData();

  // Show loading while checking auth and access
  if (authLoading || accessLoading || investorLoading) {
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

  // Allow access if user is a shareholder OR an investor
  if (!isShareholderUser && !isInvestorUser) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
