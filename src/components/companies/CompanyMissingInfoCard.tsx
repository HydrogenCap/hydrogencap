import React from 'react';
import { AlertTriangle, Users, CheckCircle, Hash } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { ShareClass, Shareholding } from '@/hooks/useCompanies';

interface CompanyMissingInfoCardProps {
  shareClasses: ShareClass[];
  shareholdings: Shareholding[];
  onConfirmShares: (shareClassId: string) => void;
  onAddShareholder: (shareClassId: string) => void;
  isConfirming?: boolean;
}

interface MissingItem {
  type: 'no_shareholders' | 'unconfirmed_shares';
  shareClass: ShareClass;
  message: string;
}

export function CompanyMissingInfoCard({
  shareClasses,
  shareholdings,
  onConfirmShares,
  onAddShareholder,
  isConfirming,
}: CompanyMissingInfoCardProps) {
  // Calculate missing items
  const missingItems: MissingItem[] = [];

  shareClasses.forEach((sc) => {
    const classHoldings = shareholdings.filter((sh) => sh.share_class_id === sc.id);
    
    // Check for no shareholders
    if (classHoldings.length === 0) {
      missingItems.push({
        type: 'no_shareholders',
        shareClass: sc,
        message: `No shareholders recorded for ${sc.name} shares`,
      });
    }

    // Check for unconfirmed share count (default 100)
    if (!sc.shares_confirmed) {
      missingItems.push({
        type: 'unconfirmed_shares',
        shareClass: sc,
        message: `${sc.name} shares: ${sc.issued_shares.toLocaleString()} issued shares not confirmed`,
      });
    }
  });

  if (missingItems.length === 0) {
    return null;
  }

  return (
    <Card className="border-warning/50 bg-warning/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-5 w-5 text-warning" />
          Missing Information
          <Badge variant="secondary" className="ml-auto">
            {missingItems.length} {missingItems.length === 1 ? 'item' : 'items'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {missingItems.map((item, index) => (
          <Alert key={`${item.shareClass.id}-${item.type}-${index}`} className="py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                {item.type === 'no_shareholders' ? (
                  <Users className="h-4 w-4 mt-0.5 text-muted-foreground" />
                ) : (
                  <Hash className="h-4 w-4 mt-0.5 text-muted-foreground" />
                )}
                <AlertDescription className="text-sm">
                  {item.message}
                </AlertDescription>
              </div>
              {item.type === 'no_shareholders' ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onAddShareholder(item.shareClass.id)}
                >
                  Add Shareholder
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onConfirmShares(item.shareClass.id)}
                  disabled={isConfirming}
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Confirm
                </Button>
              )}
            </div>
          </Alert>
        ))}
      </CardContent>
    </Card>
  );
}
