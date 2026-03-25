import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle, XCircle, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import logo from '@/assets/logo.png';

type InviteStatus = 'loading' | 'valid' | 'invalid' | 'expired' | 'accepted';

interface TenantPortalInvite {
  email: string;
}

interface TenantInviteLookupResult {
  status: InviteStatus;
  email?: string;
  error?: string;
}

interface TenantInviteAcceptResult {
  success?: boolean;
  error?: string;
}

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Something went wrong';

export default function TenantAcceptInvite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, signUp, signIn } = useAuth();

  const [inviteStatus, setInviteStatus] = useState<InviteStatus>('loading');
  const [invite, setInvite] = useState<TenantPortalInvite | null>(null);
  const [isSignUp, setIsSignUp] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function validateInvite() {
      if (!token) { setInviteStatus('invalid'); return; }

      const { data, error } = await supabase.rpc('get_tenant_portal_invite', {
        p_token: token,
      });

      const result = (data || {}) as unknown as TenantInviteLookupResult;
      if (error || !result.status) {
        setInviteStatus('invalid');
        return;
      }

      if (result.status !== 'valid') {
        setInviteStatus(result.status);
        return;
      }

      const previewInvite = { email: result.email || '' };
      setInvite(previewInvite);
      setEmail(previewInvite.email);
      setInviteStatus('valid');
    }
    validateInvite();
  }, [token]);

  // Auto-accept if already logged in
  const acceptInvite = useCallback(async () => {
    if (!token) return;
    try {
      const { data, error } = await supabase.rpc('accept_tenant_portal_invite', {
        p_token: token,
      });

      if (error) throw error;

      const result = (data || {}) as TenantInviteAcceptResult;
      if (result.error) throw new Error(result.error);

      toast.success('Welcome to the Tenant Portal!');
      navigate('/tenant-portal');
    } catch (error) {
      toast.error('Failed to accept invite', { description: getErrorMessage(error) });
    }
  }, [navigate, token]);

  useEffect(() => {
    if (
      user &&
      invite &&
      inviteStatus === 'valid' &&
      user.email &&
      user.email.toLowerCase() === invite.email.toLowerCase()
    ) {
      void acceptInvite();
    }
  }, [acceptInvite, invite, inviteStatus, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (isSignUp) {
        const { error } = await signUp(email, password, fullName);
        if (error) throw error;
        toast.info('Check your email to confirm your account, then return to this page.');
      } else {
        const { error } = await signIn(email, password);
        if (error) throw error;
        // Auth state change will trigger acceptInvite via useEffect
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  if (inviteStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (inviteStatus === 'invalid' || inviteStatus === 'expired' || inviteStatus === 'accepted') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <XCircle className="h-12 w-12 mx-auto mb-3 text-destructive" />
            <h2 className="text-lg font-semibold mb-1">
              {inviteStatus === 'invalid' && 'Invalid Invite'}
              {inviteStatus === 'expired' && 'Invite Expired'}
              {inviteStatus === 'accepted' && 'Already Accepted'}
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              {inviteStatus === 'accepted'
                ? 'This invite has already been used.'
                : 'Please contact your landlord for a new invite.'}
            </p>
            {inviteStatus === 'accepted' && (
              <Button onClick={() => navigate('/tenant-portal')}>
                <Home className="mr-2 h-4 w-4" />
                Go to Portal
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <img src={logo} alt="Logo" className="h-10 w-10 mx-auto mb-2" />
          <CardTitle>Tenant Portal Invite</CardTitle>
          <CardDescription>
            {isSignUp ? 'Create an account to access your tenant portal' : 'Sign in to accept your invite'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your name" required />
              </div>
            )}
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} disabled={!!invite?.email} required />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isSignUp ? 'Create Account' : 'Sign In'}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
              <button type="button" className="text-primary hover:underline" onClick={() => setIsSignUp(!isSignUp)}>
                {isSignUp ? 'Sign in' : 'Create one'}
              </button>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
