import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { lovable } from '@/integrations/lovable/index';
import { LogoWordmark } from '@/components/LogoWordmark';

import { passwordSchema, PASSWORD_HINT } from '@/lib/passwordSchema';

const authSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: passwordSchema,
  fullName: z.string().optional(),
});

type AuthFormData = z.infer<typeof authSchema>;

/**
 * Guard against open-redirect attacks via the `returnTo` query param.
 * Rejects:
 *  - null / empty
 *  - anything not starting with '/'
 *  - protocol-relative URLs like `//evil.com/path` or `/\evil.com`
 *  - URLs containing control characters
 */
function isSafeInternalPath(value: string | null): value is string {
  if (!value) return false;
  if (!value.startsWith('/')) return false;
  if (value.length > 1 && (value[1] === '/' || value[1] === '\\')) return false;
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f]/.test(value)) return false;
  return true;
}

function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const form = useForm<AuthFormData>({
    resolver: zodResolver(authSchema),
    defaultValues: {
      email: '',
      password: '',
      fullName: '',
    },
  });

  // Redirect if already logged in. Guard against open-redirect: protocol-relative
  // URLs like `//evil.com/…` pass a naive `startsWith('/')` check, so we also
  // require the second character to not be '/' or '\'.
  useEffect(() => {
    if (user) {
      const searchParams = new URLSearchParams(window.location.search);
      const returnTo = searchParams.get('returnTo');
      if (isSafeInternalPath(returnTo)) {
        navigate(returnTo as string, { replace: true });
      } else {
        navigate('/dashboard');
      }
    }
  }, [user, navigate]);

  const onSubmit = async (data: AuthFormData) => {
    setIsLoading(true);

    try {
      if (isLogin) {
        const { error } = await signIn(data.email, data.password);
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            toast({
              title: 'Login failed',
              description: 'Invalid email or password. Please try again.',
              variant: 'destructive',
            });
          } else {
            toast({
              title: 'Login failed',
              description: error.message,
              variant: 'destructive',
            });
          }
          return;
        }
        toast({
          title: 'Welcome back!',
          description: 'You have successfully signed in.',
        });
        const searchParams = new URLSearchParams(window.location.search);
        const returnTo = searchParams.get('returnTo');
        navigate(isSafeInternalPath(returnTo) ? (returnTo as string) : '/dashboard');
      } else {
        const { error } = await signUp(data.email, data.password, data.fullName);
        if (error) {
          if (error.message.includes('User already registered')) {
            toast({
              title: 'Account exists',
              description: 'This email is already registered. Please sign in instead.',
              variant: 'destructive',
            });
            setIsLogin(true);
          } else {
            toast({
              title: 'Sign up failed',
              description: error.message,
              variant: 'destructive',
            });
          }
          return;
        }
        toast({
          title: 'Account created!',
          description: 'Welcome to Tenure IQ.',
        });
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('Failed to authenticate:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    form.reset();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <SEO title="Sign in — TenureIQ" description="Sign in to your TenureIQ account to manage your UK property portfolio." />
      <div className="w-full max-w-md space-y-8 animate-fade-up">
         {/* Logo */}
        <div className="text-center flex flex-col items-center">
          <LogoWordmark to="/" size="lg" showSubtitle={false} />
          <p className="text-sm text-muted-foreground mt-1">Property Intelligence Platform</p>
        </div>

        <Card className="border-border/50 bg-card/50 backdrop-blur">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl">
              {isLogin ? 'Sign in to your account' : 'Create your account'}
            </CardTitle>
            <CardDescription>
              {isLogin
                ? 'Enter your credentials to access your portfolio'
                : 'Get started with your property portfolio'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {!isLogin && (
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="John Smith"
                            autoComplete="name"
                            {...field}
                            className="bg-input border-border"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="you@example.com"
                          autoComplete="email"
                          {...field}
                          className="bg-input border-border"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel>Password</FormLabel>
                        {isLogin && (
                          <Link
                            to="/forgot-password"
                            className="text-xs text-primary hover:text-primary/80 transition-colors"
                          >
                            Forgot password?
                          </Link>
                        )}
                      </div>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          autoComplete={isLogin ? "current-password" : "new-password"}
                          {...field}
                          className="bg-input border-border"
                        />
                      </FormControl>
                      <FormMessage />
                      {!isLogin && (
                        <p className="text-xs text-muted-foreground">{PASSWORD_HINT}</p>
                      )}
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isLogin ? 'Sign in' : 'Create account'}
                </Button>
              </form>
            </Form>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={isGoogleLoading}
              onClick={async () => {
                setIsGoogleLoading(true);
                const { error } = await lovable.auth.signInWithOAuth("google", {
                  redirect_uri: window.location.origin,
                });
                if (error) {
                  toast({
                    title: 'Google sign-in failed',
                    description: error.message,
                    variant: 'destructive',
                  });
                }
                setIsGoogleLoading(false);
              }}
            >
              {isGoogleLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
              )}
              Google
            </Button>
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={toggleMode}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {isLogin ? (
                  <>
                    Don't have an account?{' '}
                    <span className="text-primary font-medium">Sign up</span>
                  </>
                ) : (
                  <>
                    Already have an account?{' '}
                    <span className="text-primary font-medium">Sign in</span>
                  </>
                )}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default AuthPage;
