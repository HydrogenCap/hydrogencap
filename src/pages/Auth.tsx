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
import { LogoWordmark } from '@/components/LogoWordmark';

import { passwordSchema, PASSWORD_HINT } from '@/lib/passwordSchema';

const authSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: passwordSchema,
  fullName: z.string().optional(),
});

type AuthFormData = z.infer<typeof authSchema>;

function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
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

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      const searchParams = new URLSearchParams(window.location.search);
      const returnTo = searchParams.get('returnTo');
      if (returnTo && returnTo.startsWith('/')) {
        navigate(returnTo, { replace: true });
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
        navigate(returnTo && returnTo.startsWith('/') ? returnTo : '/dashboard');
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
    } catch {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred. Please try again.',
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
