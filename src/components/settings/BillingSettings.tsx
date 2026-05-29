import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSubscription, TIERS, type SubscriptionTier } from '@/contexts/SubscriptionContext';
import { supabase } from '@/integrations/supabase/client';
import { Check, Crown, Loader2, ExternalLink, RefreshCw, Star, Shield, Zap } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from "sonner";

const PLAN_DETAILS: {
  tier: SubscriptionTier;
  name: string;
  price: string;
  annualPrice?: string;
  annualSaving?: string;
  priceId: string | null;
  features: string[];
  propertyLimit: string;
  idealFor: string;
  popular?: boolean;
}[] = [
  {
    tier: 'free',
    name: 'Explorer',
    price: '£0',
    priceId: null,
    propertyLimit: 'Up to 2 properties or rooms',
    features: [
      'Core property tracking',
      '5 document uploads',
      'Compliance register (view only)',
      'Community / email support (48–72 hrs)',
    ],
    idealFor: 'Testing the system before committing.',
  },
  {
    tier: 'solo',
    name: 'Solo Landlord',
    price: '£29',
    annualPrice: '£24/mo billed annually',
    annualSaving: 'Save £60/year',
    priceId: TIERS.solo.price_id,
    propertyLimit: 'Up to 10 properties or rooms',
    features: [
      'Full compliance tracking',
      '100 document storage',
      'Tenant & rent management',
      'Contractor management',
      'Basic reports',
      'Email support (24 hrs)',
    ],
    idealFor: 'Individual landlords and small portfolios.',
  },
  {
    tier: 'portfolio',
    name: 'Portfolio',
    price: '£79',
    annualPrice: '£64/mo billed annually',
    annualSaving: 'Save £180/year',
    priceId: TIERS.portfolio.price_id,
    propertyLimit: 'Up to 50 properties or rooms',
    popular: true,
    features: [
      'AI compliance checker',
      'AI property valuations',
      'Bank-ready reports',
      'Ownership attribution',
      'Portfolio analytics dashboard',
      'Shareable document links',
      'Priority email support',
    ],
    idealFor: 'Growing portfolios and professional investors.',
  },
  {
    tier: 'pro',
    name: 'Pro',
    price: '£199',
    annualPrice: '£169/mo billed annually',
    annualSaving: 'Save £360/year',
    priceId: TIERS.pro.price_id,
    propertyLimit: 'Unlimited properties & rooms',
    features: [
      'Shareholder portal',
      'Company secrets vault',
      'Passport autofill',
      'API access',
      'Team roles & permissions',
      'Priority support',
      'Dedicated onboarding call',
      'SLA uptime guarantee',
    ],
    idealFor: 'Agencies, HMO operators, and large portfolios.',
  },
];

const TIER_ORDER: SubscriptionTier[] = ['free', 'solo', 'portfolio', 'pro'];

export function BillingSettings() {
  const { tier, subscribed, subscriptionEnd, checkSubscription, loading } = useSubscription();
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
      toast.error('Checkout failed', { description: err instanceof Error ? err.message : 'Please try again' });
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
      toast.error('Portal failed', { description: err instanceof Error ? err.message : 'Please try again' });
    } finally {
      setPortalLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await checkSubscription();
    setRefreshing(false);
    toast('Subscription status refreshed');
  };

  const currentTierIndex = TIER_ORDER.indexOf(tier);

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-foreground">Pricing Plans</h2>
        <p className="text-muted-foreground">Simple, transparent pricing for property developers, landlords, and portfolio managers.</p>
      </div>

      {/* Current plan summary */}
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-primary" />
                Current Plan: {PLAN_DETAILS.find(p => p.tier === tier)?.name ?? 'Explorer'}
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
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {PLAN_DETAILS.map((plan) => {
          const isCurrent = plan.tier === tier;
          const planIndex = TIER_ORDER.indexOf(plan.tier);
          const isUpgrade = planIndex > currentTierIndex;
          const isDowngrade = planIndex < currentTierIndex && planIndex > 0;

          return (
            <Card
              key={plan.tier}
              className={`relative bg-card border-border flex flex-col ${
                isCurrent ? 'ring-2 ring-primary' : ''
              } ${plan.popular ? 'border-primary/50' : ''}`}
            >
              {isCurrent && (
                <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
                  Your Plan
                </Badge>
              )}
              {plan.popular && !isCurrent && (
                <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary/90 text-primary-foreground">
                  <Star className="h-3 w-3 mr-1" /> Most Popular
                </Badge>
              )}
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{plan.name}</CardTitle>
                <div className="space-y-1">
                  <div className="text-2xl font-bold text-foreground">
                    {plan.price}
                    {plan.tier !== 'free' && <span className="text-sm font-normal text-muted-foreground">/mo</span>}
                  </div>
                  {plan.annualPrice && (
                    <p className="text-xs text-muted-foreground">{plan.annualPrice}</p>
                  )}
                  {plan.annualSaving && (
                    <Badge variant="secondary" className="text-xs">{plan.annualSaving}</Badge>
                  )}
                </div>
                <CardDescription className="text-xs font-medium">{plan.propertyLimit}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  {plan.tier !== 'free' && plan.tier !== 'solo' && (
                    <p className="text-xs text-muted-foreground italic">
                      Everything in {plan.tier === 'portfolio' ? 'Solo Landlord' : 'Portfolio'}, plus:
                    </p>
                  )}
                  <ul className="space-y-2 text-sm">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <span className="text-muted-foreground">{f}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-muted-foreground pt-2 border-t border-border">
                    <span className="font-medium text-foreground">Ideal for:</span> {plan.idealFor}
                  </p>
                </div>

                <div>
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
                      Free Forever
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Trust signals */}
      <Card className="bg-card border-border">
        <CardContent className="py-6">
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
            {['GDPR Compliant', 'UK Data Hosting', 'Secure Document Vault', 'Bank-Grade Encryption', 'Cancel Anytime', 'No Hidden Fees'].map((item) => (
              <div key={item} className="flex items-center gap-1.5">
                <Shield className="h-4 w-4 text-primary" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Enterprise CTA */}
      <Card className="bg-muted/30 border-dashed border-border text-center">
        <CardContent className="py-8 space-y-3">
          <Zap className="h-8 w-8 text-primary mx-auto" />
          <h3 className="text-lg font-semibold text-foreground">Need Something Bigger?</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Managing <strong>250+ properties</strong> or require bespoke features? Contact us for custom enterprise pricing.
          </p>
          <Button variant="outline" asChild>
            <a href="/contact">Contact Us</a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
