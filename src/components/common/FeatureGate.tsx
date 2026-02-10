import { useSubscription, type FeatureFlag } from '@/contexts/SubscriptionContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';

interface FeatureGateProps {
  feature: FeatureFlag;
  children: ReactNode;
  fallback?: ReactNode;
}

export function FeatureGate({ feature, children, fallback }: FeatureGateProps) {
  const { hasFeature } = useSubscription();
  const navigate = useNavigate();

  if (hasFeature(feature)) return <>{children}</>;

  if (fallback) return <>{fallback}</>;

  return (
    <Card className="bg-muted/50 border-dashed border-border">
      <CardContent className="flex flex-col items-center justify-center py-8 text-center gap-3">
        <Lock className="h-8 w-8 text-muted-foreground" />
        <div>
          <p className="font-medium text-foreground">Premium Feature</p>
          <p className="text-sm text-muted-foreground">Upgrade your plan to access this feature</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('/settings?tab=billing')}>
          View Plans
        </Button>
      </CardContent>
    </Card>
  );
}
