import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LogIn, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export function SessionExpiryModal() {
  const [expired, setExpired] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Listen for custom session-expired events from query error handler
    const handler = () => setExpired(true);
    window.addEventListener('session-expired', handler);

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setExpired(true);
      }
    });

    return () => {
      window.removeEventListener('session-expired', handler);
      subscription.unsubscribe();
    };
  }, []);

  const handleSignIn = () => {
    setExpired(false);
    navigate('/auth');
  };

  return (
    <Dialog open={expired} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
          </div>
          <DialogTitle className="text-center">Session Expired</DialogTitle>
          <DialogDescription className="text-center">
            Your session has expired. Please sign in again to continue. Any unsaved changes will not be lost.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-center">
          <Button onClick={handleSignIn} className="w-full sm:w-auto">
            <LogIn className="h-4 w-4 mr-2" />
            Sign In Again
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
