import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle2, AlertTriangle, LogIn } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useAcceptTeamInvite } from '@/hooks/useTeamManagement';

export default function AcceptTeamInvite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const acceptInvite = useAcceptTeamInvite();
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    if (authLoading || !token || attempted) return;

    if (!user) {
      const returnUrl = `/team/accept/${token}`;
      navigate(`/auth?returnTo=${encodeURIComponent(returnUrl)}`, { replace: true });
      return;
    }

    setAttempted(true);
    acceptInvite.mutate(token);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, token, attempted]);

  if (authLoading || (!attempted && user)) {
    return (
      <CenteredCard>
        <div className="flex flex-col items-center gap-4 py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Processing invite…</p>
        </div>
      </CenteredCard>
    );
  }

  if (acceptInvite.isPending) {
    return (
      <CenteredCard>
        <div className="flex flex-col items-center gap-4 py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Accepting invite…</p>
        </div>
      </CenteredCard>
    );
  }

  if (acceptInvite.isSuccess) {
    return (
      <CenteredCard>
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h3 className="text-xl font-semibold">You're in!</h3>
            <p className="text-muted-foreground mt-1">
              You now have access to the portfolio.
            </p>
          </div>
          <Button onClick={() => navigate('/')} className="mt-4">
            Go to Dashboard
          </Button>
        </div>
      </CenteredCard>
    );
  }

  if (acceptInvite.isError) {
    return (
      <CenteredCard>
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <div>
            <h3 className="text-xl font-semibold">Invite Failed</h3>
            <p className="text-muted-foreground mt-1">
              {acceptInvite.error.message}
            </p>
          </div>
          <div className="flex gap-3 mt-4">
            <Button variant="outline" onClick={() => navigate('/auth')}>
              <LogIn className="h-4 w-4 mr-2" />
              Sign In
            </Button>
            <Button onClick={() => navigate('/')}>
              Go to Dashboard
            </Button>
          </div>
        </div>
      </CenteredCard>
    );
  }

  return null;
}

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">HydrogenCap</CardTitle>
          <CardDescription>Team Invite</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  );
}
