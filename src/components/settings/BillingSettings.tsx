import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSubscription, TIERS, type SubscriptionTier } from '@/contexts/SubscriptionContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Check, Crown, Loader2, ExternalLink, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

const PLAN_DETAILS: {
  tier: SubscriptionTier;
  name: string;
  price: string;
  priceId: string | null;
  features: string[];
  propertyLimit: string;
}[] = [
  {
    tier: 'free',
    name: 'Free',
    price: '£0',
    priceId: null,
    propertyLimit: '3 properties',
    features: [
      'Core property tracking',
      'Basic compliance register',
      'Document storage',
    ],
  },
  {
    tier: 'starter',
    name: 'Starter',
    price: '£29',
    priceId: TIERS.starter.price_id,
    propertyLimit: '10 properties',
    features: [
      'Everything in Free',
      'Full compliance tracking',
      'Contractor management',
      'Tenant & rent management',
    ],
  },
  {
    tier: 'professional',
    name: 'Professional',
    price: '£79',
    priceId: TIERS.professional.price_id,
    propertyLimit: '50 properties',
    features: [
      'Everything in Starter',
      'AI compliance checker',
      'AI property valuations',
      'Bank-ready reports',
      'Ownership attribution',
    ],
  },
  {
    tier: 'enterprise',
    name: 'Enterprise',
    price: '£199',
    priceId: TIERS.enterprise.price_id,
    propertyLimit: 'Unlimited properties',
    features: [
      'Everything in Professional',
      'Portfolio AI chat',
      'Passport autofill',
      'Shareholder portal',
      'Company secrets vault',
      'Priority support',
    ],
  },
];

const TIER_ORDER: SubscriptionTier[] = ['free', 'starter', 'professional', 'enterprise'];

export function BillingSettings() {
  const { tier, subscribed, subscriptionEnd, checkSubscription, loading } = useSubscription();
  const { toast } = useToast();
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const handleCheckout = async (priceId: string) => {
    setCheckoutLoading(priceId);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { priceId },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (err) {
      toast({
        title: 'Checkout failed',
        description: err instanceof Error ? err.message : 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handleManage = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (err) {
      toast({
        title: 'Portal failed',
        description: err instanceof Error ? err.message : 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setPortalLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await checkSubscription();
    setRefreshing(false);
    toast({ title: 'Subscription status refreshed' });
  };

  const currentTierIndex = TIER_ORDER.indexOf(tier);

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Current plan summary */}
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-primary" />
                Current Plan: {PLAN_DETAILS.find(p => p.tier === tier)?.name ?? 'Free'}
              </CardTitle>
              <CardDescription>
                {subscribed && subscriptionEnd
                  ? `Renews ${format(new Date(subscriptionEnd), 'dd MMM yyyy')}`
                  : 'No active subscription'}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
                <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              {subscribed && (
                <Button variant="outline" size="sm" onClick={handleManage} disabled={portalLoading}>
                  {portalLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ExternalLink className="h-4 w-4 mr-1" />}
                  Manage Subscription
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Plans grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {PLAN_DETAILS.map((plan) => {
          const isCurrent = plan.tier === tier;
          const planIndex = TIER_ORDER.indexOf(plan.tier);
          const isUpgrade = planIndex > currentTierIndex;
          const isDowngrade = planIndex < currentTierIndex && planIndex > 0;

          return (
            <Card
              key={plan.tier}
              className={`relative bg-card border-border ${isCurrent ? 'ring-2 ring-primary' : ''}`}
            >
              {isCurrent && (
                <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
                  Your Plan
                </Badge>
              )}
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{plan.name}</CardTitle>
                <div className="text-2xl font-bold text-foreground">
                  {plan.price}
                  {plan.tier !== 'free' && <span className="text-sm font-normal text-muted-foreground">/mo</span>}
                </div>
                <CardDescription>{plan.propertyLimit}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-sm">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <span className="text-muted-foreground">{f}</span>
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <Button variant="secondary" className="w-full" disabled>
                    Current Plan
                  </Button>
                ) : plan.priceId && isUpgrade ? (
                  <Button
                    className="w-full"
                    onClick={() => handleCheckout(plan.priceId!)}
                    disabled={!!checkoutLoading || loading}
                  >
                    {checkoutLoading === plan.priceId ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : null}
                    Upgrade
                  </Button>
                ) : plan.priceId && isDowngrade ? (
                  <Button variant="outline" className="w-full" onClick={handleManage} disabled={portalLoading}>
                    Downgrade
                  </Button>
                ) : plan.tier === 'free' ? (
                  <Button variant="ghost" className="w-full" disabled>
                    Free
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
