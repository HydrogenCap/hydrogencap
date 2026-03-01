import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, MailCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useOnboardingStatus } from '@/hooks/useOnboardingStatus';
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';
import { useSectionVisibility } from '@/hooks/useSectionVisibility';
import { useToast } from '@/hooks/use-toast';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading, signOut } = useAuth();
  const { data: onboardingCompleted, isLoading: onboardingLoading } = useOnboardingStatus();
  const { isRouteHidden, isLoading: visibilityLoading } = useSectionVisibility();
  const location = useLocation();
  const { toast } = useToast();

  if (loading || (user && (onboardingLoading || visibilityLoading))) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Enforce email verification
  if (!user.email_confirmed_at) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <MailCheck className="mx-auto h-12 w-12 text-primary mb-2" />
            <CardTitle>Verify Your Email</CardTitle>
            <CardDescription>
              We've sent a verification link to <strong>{user.email}</strong>. 
              Please check your inbox and click the link to continue.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              Didn't receive the email? Check your spam folder or sign out and try again.
            </p>
            <Button variant="outline" onClick={signOut}>
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show onboarding wizard for new users
  if (onboardingCompleted === false) {
    return <OnboardingWizard />;
  }

  // Redirect if section is hidden
  if (isRouteHidden(location.pathname)) {
    toast({
      title: 'Section hidden',
      description: 'This section is currently hidden. You can enable it in Settings → Sections.',
    });
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
