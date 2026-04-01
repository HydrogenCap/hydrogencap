import React, { useState } from 'react';
import { Coins, Pencil, Check, X, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCompany, useUpdateShareClass, type ShareClass } from '@/hooks/useCompanies';
import { useToast } from '@/hooks/use-toast';

interface ShareCapitalCardProps {
  companyId: string;
}

export function ShareCapitalCard({ companyId }: ShareCapitalCardProps) {
  const { data: company, isLoading } = useCompany(companyId);
  const updateShareClass = useUpdateShareClass();
  const { toast } = useToast();

  const [editingClass, setEditingClass] = useState<ShareClass | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleEdit = (sc: ShareClass) => {
    setEditingClass(sc);
    setEditValue(sc.issued_shares.toString());
  };

  const handleSave = async () => {
    if (!editingClass) return;
    const shares = parseInt(editValue);
    if (isNaN(shares) || shares < 1) {
      toast({ title: 'Invalid', description: 'Enter a valid number of shares', variant: 'destructive' });
      return;
    }
    try {
      await updateShareClass.mutateAsync({
        id: editingClass.id,
        issued_shares: shares,
        shares_confirmed: true,
      });
      toast({ title: 'Share capital updated' });
      setEditingClass(null);
    } catch (error) {
      console.error('Failed to update share capital:', error);
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to update share capital', variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Coins className="h-5 w-5" />
            Share Capital
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  const shareClasses = company?.share_classes || [];

  if (shareClasses.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Coins className="h-5 w-5" />
            Share Capital
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No share classes defined</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Coins className="h-5 w-5" />
            Share Capital
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {shareClasses.map((sc) => (
            <div
              key={sc.id}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
            >
              <div className="flex items-center gap-3">
                <div>
                  <p className="font-medium">{sc.name} Shares</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-sm text-muted-foreground">
                      {sc.issued_shares.toLocaleString()} issued
                    </span>
                    {sc.nominal_value && (
                      <span className="text-xs text-muted-foreground">
                        @ £{sc.nominal_value} each
                      </span>
                    )}
                    {!sc.shares_confirmed && (
                      <Badge variant="outline" className="text-xs text-warning border-warning">
                        Unconfirmed
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => handleEdit(sc)}>
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            This determines how ownership percentages are calculated from shareholdings.
          </p>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingClass} onOpenChange={(open) => !open && setEditingClass(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Share Capital</DialogTitle>
            <DialogDescription>
              Set the total number of issued shares for {editingClass?.name} class.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="issued-shares">Total Issued Shares</Label>
              <Input
                id="issued-shares"
                type="number"
                min="1"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                placeholder="e.g., 100"
              />
              <p className="text-xs text-muted-foreground">
                The total number of shares the company has issued. Each shareholder's percentage is calculated as their shares divided by this total.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingClass(null)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={updateShareClass.isPending}>
              {updateShareClass.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
