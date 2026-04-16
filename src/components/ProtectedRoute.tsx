import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, MailCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useOnboardingStatus } from '@/hooks/useOnboardingStatus';
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';
import { useSectionVisibility } from '@/hooks/useSectionVisibility';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect, useCallback } from 'react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading, signOut } = useAuth();
  const { data: onboardingCompleted, isLoading: onboardingLoading } = useOnboardingStatus();
  const { isRouteHidden, isLoading: visibilityLoading } = useSectionVisibility();
  const location = useLocation();
  const { toast } = useToast();
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Fire the "section hidden" toast from an effect rather than during render.
  // Calling `toast()` inside render causes React 19 StrictMode to double-fire
  // and is a side-effect that React explicitly forbids.
  const hidden = !loading && !!user && isRouteHidden(location.pathname);
  useEffect(() => {
    if (hidden) {
      toast({
        title: 'Section hidden',
        description: 'This section is currently hidden. You can enable it in Settings → Sections.',
      });
    }
  }, [hidden, toast]);

  const handleResendVerification = useCallback(async () => {
    if (!user?.email || resendCooldown > 0) return;
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email: user.email });
      if (error) throw error;
      setResendCooldown(60);
      toast({ title: 'Verification email sent', description: 'Please check your inbox.' });
    } catch (err) {
      const description = err instanceof Error ? err.message : 'Please try again later.';
      toast({ title: 'Failed to resend', description, variant: 'destructive' });
    }
  }, [user?.email, resendCooldown, toast]);

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
              Didn't receive the email? Check your spam folder or click below to resend.
            </p>
            <div className="flex flex-col gap-2">
              <Button
                onClick={handleResendVerification}
                disabled={resendCooldown > 0}
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend verification email'}
              </Button>
              <Button variant="outline" onClick={signOut}>
                Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show onboarding wizard for new users
  if (onboardingCompleted === false) {
    return <OnboardingWizard />;
  }

  // Redirect if section is hidden (toast is fired by the effect above)
  if (isRouteHidden(location.pathname)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
