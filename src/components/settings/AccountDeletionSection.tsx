import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';

export function AccountDeletionSection() {
  const navigate = useNavigate();
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canDelete = confirmText === 'DELETE';

  const handleDelete = async () => {
    if (!canDelete) return;
    setIsDeleting(true);
    setError(null);

    try {
      const { error: fnError } = await supabase.functions.invoke('delete-account');
      if (fnError) {
        setError(fnError.message || 'Failed to delete account');
        return;
      }
      await supabase.auth.signOut();
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete account');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          Delete Account
        </CardTitle>
        <CardDescription>
          Permanently delete your account and all associated personal data. This action cannot be undone.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-4 text-sm space-y-1">
          <p className="font-medium text-destructive">Before deleting your account:</p>
          <ul className="list-disc list-inside space-y-1 text-destructive/80">
            <li>Transfer ownership of any organisations you own, or close them first</li>
            <li>Download any data you need from the Backup &amp; Export tab</li>
            <li>Your personal data will be permanently anonymised</li>
          </ul>
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <div className="space-y-2">
          <Label htmlFor="confirm-delete">
            Type <span className="font-mono font-bold">DELETE</span> to confirm
          </Label>
          <Input
            id="confirm-delete"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="DELETE"
            className="max-w-xs"
          />
        </div>

        <Button
          variant="destructive"
          disabled={!canDelete || isDeleting}
          onClick={handleDelete}
        >
          {isDeleting ? 'Deleting account...' : 'Delete my account'}
        </Button>
      </CardContent>
    </Card>
  );
}
