import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Loader2, CheckCircle, XCircle, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import logo from '@/assets/logo.png';

type InviteStatus = 'loading' | 'valid' | 'invalid' | 'expired' | 'accepted';

export default function AcceptInvite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, signUp, signIn } = useAuth();

  const [inviteStatus, setInviteStatus] = useState<InviteStatus>('loading');
  const [invite, setInvite] = useState<any>(null);
  const [isSignUp, setIsSignUp] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Validate invite on mount
  useEffect(() => {
    async function validateInvite() {
      if (!token) {
        setInviteStatus('invalid');
        return;
      }

      const { data, error } = await supabase
        .from('shareholder_invites')
        .select('*')
        .eq('token', token)
        .single();

      if (error || !data) {
        setInviteStatus('invalid');
        return;
      }

      if (data.accepted_at) {
        setInviteStatus('accepted');
        return;
      }

      if (new Date(data.expires_at) < new Date()) {
        setInviteStatus('expired');
        return;
      }

      setInvite(data);
      setEmail(data.email);
      setFullName(data.name || '');
      setInviteStatus('valid');
    }

    validateInvite();
  }, [token]);

  // If user is already logged in with matching email, accept automatically
  useEffect(() => {
    async function autoAccept() {
      if (user && invite && user.email === invite.email) {
        await acceptInvite(user.id);
      }
    }
    autoAccept();
  }, [user, invite]);

  const acceptInvite = async (userId: string) => {
    try {
      // Create shareholder access
      const { error: accessError } = await supabase
        .from('shareholder_access')
        .insert({
          org_id: invite.org_id,
          user_id: userId,
          invite_id: invite.id,
          access_level: 'read_only',
          can_view_financials: true,
          can_view_compliance: true,
          can_view_documents: true,
        });

      if (accessError) throw accessError;

      // Mark invite as accepted
      await supabase
        .from('shareholder_invites')
        .update({ accepted_at: new Date().toISOString() })
        .eq('id', invite.id);

      toast.success('Invitation accepted! Welcome to the portal.');
      navigate('/portal');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to accept invitation');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (isSignUp) {
        const { error } = await signUp(email, password, fullName);
        if (error) throw error;
        toast.success('Account created! Please check your email to verify, then sign in.');
        setIsSignUp(false);
      } else {
        const { error } = await signIn(email, password);
        if (error) throw error;
        // Auto-accept will trigger via useEffect
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Authentication failed');
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

  if (inviteStatus === 'invalid') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <XCircle className="mx-auto h-12 w-12 text-destructive" />
            <CardTitle>Invalid Invitation</CardTitle>
            <CardDescription>
              This invitation link is invalid or has already been used.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Link to="/auth">
              <Button>Go to Sign In</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (inviteStatus === 'expired') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <XCircle className="mx-auto h-12 w-12 text-warning" />
            <CardTitle>Invitation Expired</CardTitle>
            <CardDescription>
              This invitation has expired. Please contact the portfolio owner for a new invitation.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (inviteStatus === 'accepted') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CheckCircle className="mx-auto h-12 w-12 text-primary" />
            <CardTitle>Already Accepted</CardTitle>
            <CardDescription>
              This invitation has already been accepted.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Link to="/portal">
              <Button>Go to Portal</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <img src={logo} alt="Logo" className="mx-auto h-12 w-12 mb-4" />
          <UserPlus className="mx-auto h-8 w-8 text-primary mb-2" />
          <CardTitle>You're Invited</CardTitle>
          <CardDescription>
            You've been invited to view a property portfolio as a shareholder.
            {invite?.name && <span className="block mt-1 font-medium">{invite.name}</span>}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={!!invite?.email}
                required
              />
            </div>

            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Smith"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isSignUp ? 'Create a password' : 'Enter your password'}
                required
                minLength={6}
              />
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSignUp ? 'Create Account & Accept' : 'Sign In & Accept'}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-primary hover:underline"
              >
                {isSignUp ? 'Sign in' : 'Create one'}
              </button>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
