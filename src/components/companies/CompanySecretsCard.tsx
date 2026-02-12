import React, { useState } from 'react';
import { Shield, Eye, EyeOff, Copy, Pencil, Check, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  useCompanySecretsMasked,
  useRevealSecrets,
  useSetCompanySecrets,
} from '@/hooks/useCompanySecrets';
import { useToast } from '@/hooks/use-toast';
import { formatDateUK } from '@/lib/calculations';

interface CompanySecretsCardProps {
  companyId: string;
}

export function CompanySecretsCard({ companyId }: CompanySecretsCardProps) {
  const { data: maskedSecrets, isLoading } = useCompanySecretsMasked(companyId);
  const revealSecrets = useRevealSecrets();
  const setSecrets = useSetCompanySecrets();
  const { toast } = useToast();

  const [revealed, setRevealed] = useState<{ auth_code: string | null; utr: string | null } | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editAuthCode, setEditAuthCode] = useState('');
  const [editUtr, setEditUtr] = useState('');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleReveal = async () => {
    try {
      const result = await revealSecrets.mutateAsync(companyId);
      setRevealed(result);
    } catch (err) {
      console.error('Failed to reveal secrets:', err);
    }
  };

  const handleHide = () => {
    setRevealed(null);
  };

  const handleCopy = async (value: string, field: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedField(field);
    // Don't show toast with value for security
    toast({ title: 'Copied to clipboard' });
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleEdit = () => {
    setEditAuthCode('');
    setEditUtr('');
    setEditOpen(true);
  };

  const handleSave = async () => {
    try {
      await setSecrets.mutateAsync({
        companyId,
        authCode: editAuthCode || undefined,
        utr: editUtr || undefined,
      });
      setEditOpen(false);
      setRevealed(null); // Hide after edit
    } catch (err) {
      console.error('Failed to save secrets:', err);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Sensitive Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  const hasAuthCode = !!maskedSecrets?.auth_code_last4;
  const hasUtr = !!maskedSecrets?.utr_last4;
  const hasAnySecrets = hasAuthCode || hasUtr;
  const isRevealed = !!revealed;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Sensitive Details
            </CardTitle>
            <div className="flex items-center gap-2">
              {hasAnySecrets && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={isRevealed ? handleHide : handleReveal}
                  disabled={revealSecrets.isPending}
                  className="h-7 text-xs"
                >
                  {revealSecrets.isPending ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : isRevealed ? (
                    <EyeOff className="h-3 w-3 mr-1" />
                  ) : (
                    <Eye className="h-3 w-3 mr-1" />
                  )}
                  {isRevealed ? 'Hide' : 'Reveal'}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleEdit}
                className="h-7 text-xs"
              >
                <Pencil className="h-3 w-3 mr-1" />
                Edit
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Auth Code Row */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div>
              <p className="text-sm text-muted-foreground">Companies House Auth Code</p>
              <p className="font-mono font-medium">
                {isRevealed && revealed?.auth_code
                  ? revealed.auth_code
                  : hasAuthCode
                    ? maskedSecrets?.auth_code_masked
                    : '—'}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {hasAuthCode && (
                <Badge variant="outline" className="text-xs text-success border-success">
                  Set
                </Badge>
              )}
              {isRevealed && revealed?.auth_code && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handleCopy(revealed.auth_code!, 'auth_code')}
                >
                  {copiedField === 'auth_code' ? (
                    <Check className="h-3 w-3 text-success" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* UTR Row */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div>
              <p className="text-sm text-muted-foreground">HMRC UTR</p>
              <p className="font-mono font-medium">
                {isRevealed && revealed?.utr
                  ? revealed.utr
                  : hasUtr
                    ? maskedSecrets?.utr_masked
                    : '—'}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {hasUtr && (
                <Badge variant="outline" className="text-xs text-success border-success">
                  Set
                </Badge>
              )}
              {isRevealed && revealed?.utr && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handleCopy(revealed.utr!, 'utr')}
                >
                  {copiedField === 'utr' ? (
                    <Check className="h-3 w-3 text-success" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              )}
            </div>
          </div>

          {!hasAnySecrets && (
            <p className="text-xs text-muted-foreground text-center py-2">
              No sensitive details stored. Click Edit to add.
            </p>
          )}

          {maskedSecrets?.updated_at && (
            <p className="text-xs text-muted-foreground">
              Last updated: {formatDateUK(maskedSecrets.updated_at)}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Edit Sensitive Details
            </DialogTitle>
            <DialogDescription>
              Enter the new values. Leave blank to keep existing values unchanged.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="auth-code">Companies House Auth Code</Label>
              <Input
                id="auth-code"
                type="text"
                value={editAuthCode}
                onChange={(e) => setEditAuthCode(e.target.value.toUpperCase())}
                placeholder="e.g. ABC123"
                className="font-mono"
                maxLength={10}
              />
              <p className="text-xs text-muted-foreground">
                6-character code from Companies House for filing.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="utr">HMRC Unique Taxpayer Reference (UTR)</Label>
              <Input
                id="utr"
                type="text"
                value={editUtr}
                onChange={(e) => setEditUtr(e.target.value.replace(/\D/g, ''))}
                placeholder="e.g. 1234567890"
                className="font-mono"
                maxLength={10}
              />
              <p className="text-xs text-muted-foreground">
                10-digit number from HMRC for corporation tax.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={setSecrets.isPending || (!editAuthCode && !editUtr)}
            >
              {setSecrets.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Securely'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
