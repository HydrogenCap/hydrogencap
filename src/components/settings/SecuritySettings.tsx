import React, { useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Loader2, CheckCircle2, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

import { passwordSchema, PASSWORD_HINT } from '@/lib/passwordSchema';
import { toast } from "sonner";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;

export function SecuritySettings() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const { signOut: _signOut } = useAuth();

  const form = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: ChangePasswordFormData) => {
    setIsLoading(true);
    setIsSuccess(false);

    try {
      // First verify current password by re-authenticating
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user?.email) {
        toast.error('Error', { description: 'Unable to verify your account. Please try again.' });
        return;
      }

      // Try to sign in with current password to verify it
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: data.currentPassword,
      });

      if (signInError) {
        toast.error('Incorrect password', { description: 'The current password you entered is incorrect.' });
        return;
      }

      // Update to new password
      const { error: updateError } = await supabase.auth.updateUser({
        password: data.newPassword,
      });

      if (updateError) {
        toast.error('Error', { description: updateError.message });
        return;
      }

      setIsSuccess(true);
      form.reset();
      
      toast('Password changed', { description: 'Your password has been successfully updated.' });

      // Clear success message after 5 seconds
      setTimeout(() => setIsSuccess(false), 5000);
    } catch {
      toast.error('Error', { description: 'An unexpected error occurred. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOutAll = async () => {
    setIsSigningOut(true);
    try {
      // Sign out from all sessions
      await supabase.auth.signOut({ scope: 'global' });
      
      toast.success('Signed out', { description: 'You have been signed out from all devices.' });
      
      // Redirect will happen automatically via auth state change
    } catch {
      toast.error('Error', { description: 'Failed to sign out from all sessions.' });
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Security
        </CardTitle>
        <CardDescription>Manage your password and security settings</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Change Password Form */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-foreground">Change Password</h3>
          
          {isSuccess && (
            <Alert className="border-primary/50 bg-primary/10">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <AlertDescription className="text-foreground">
                Password changed successfully.
              </AlertDescription>
            </Alert>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••••"
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
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        {...field}
                        className="bg-input border-border"
                      />
                    </FormControl>
                    <FormMessage />
                    <p className="text-xs text-muted-foreground">{PASSWORD_HINT}</p>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm New Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        {...field}
                        className="bg-input border-border"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Change Password
              </Button>
            </form>
          </Form>
        </div>

        {/* Divider */}
        <div className="border-t border-border" />

        {/* Sign Out All Sessions */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-foreground">Sessions</h3>
          <p className="text-sm text-muted-foreground">
            Sign out from all devices and browsers where you're currently logged in.
          </p>
          <Button 
            variant="outline" 
            onClick={handleSignOutAll}
            disabled={isSigningOut}
            className="text-destructive hover:text-destructive"
          >
            {isSigningOut ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="mr-2 h-4 w-4" />
            )}
            Log out all sessions
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
