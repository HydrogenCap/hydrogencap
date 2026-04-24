/* eslint-disable react-refresh/only-export-components -- provider, hook, and helpers are intentionally co-located */
import { createContext, useContext, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export type SubscriptionTier = 'free' | 'solo' | 'portfolio' | 'pro';

interface SubscriptionState {
  subscribed: boolean;
  tier: SubscriptionTier;
  productId: string | null;
  subscriptionEnd: string | null;
  loading: boolean;
}

interface SubscriptionContextType extends SubscriptionState {
  checkSubscription: () => Promise<void>;
  hasFeature: (feature: FeatureFlag) => boolean;
  propertyLimit: number;
  documentLimit: number;
}

export type FeatureFlag =
  | 'full_compliance_tracking'
  | 'tenant_rent_management'
  | 'contractor_management'
  | 'basic_reports'
  | 'ai_compliance_checker'
  | 'ai_valuations'
  | 'bank_ready_reports'
  | 'ownership_attribution'
  | 'portfolio_analytics'
  | 'shareable_doc_links'
  | 'shareholder_portal'
  | 'company_secrets'
  | 'passport_autofill'
  | 'api_access'
  | 'team_roles'
  | 'unlimited_properties';

// Stripe product/price IDs are publishable identifiers (not secrets)
const TIERS = {
  solo: {
    product_id: 'prod_TxJdFT8No80v9S',
    price_id: 'price_1SzP0MAZFDMuITvQvU1ICh4p',
  },
  portfolio: {
    product_id: 'prod_TxJeOM05Pg5FWE',
    price_id: 'price_1SzP1KAZFDMuITvQ4pZv6t5R',
  },
  pro: {
    product_id: 'prod_TxJeGRcMMMPHwP',
    price_id: 'price_1SzP1aAZFDMuITvQsijsXgos',
  },
};

export { TIERS };

const TIER_FEATURES: Record<SubscriptionTier, FeatureFlag[]> = {
  free: [],
  solo: [
    'full_compliance_tracking',
    'tenant_rent_management',
    'contractor_management',
    'basic_reports',
  ],
  portfolio: [
    'full_compliance_tracking',
    'tenant_rent_management',
    'contractor_management',
    'basic_reports',
    'ai_compliance_checker',
    'ai_valuations',
    'bank_ready_reports',
    'ownership_attribution',
    'portfolio_analytics',
    'shareable_doc_links',
  ],
  pro: [
    'full_compliance_tracking',
    'tenant_rent_management',
    'contractor_management',
    'basic_reports',
    'ai_compliance_checker',
    'ai_valuations',
    'bank_ready_reports',
    'ownership_attribution',
    'portfolio_analytics',
    'shareable_doc_links',
    'shareholder_portal',
    'company_secrets',
    'passport_autofill',
    'api_access',
    'team_roles',
    'unlimited_properties',
  ],
};

const TIER_PROPERTY_LIMITS: Record<SubscriptionTier, number> = {
  free: 2,
  solo: 10,
  portfolio: 50,
  pro: Infinity,
};

const TIER_DOCUMENT_LIMITS: Record<SubscriptionTier, number> = {
  free: 5,
  solo: 100,
  portfolio: Infinity,
  pro: Infinity,
};

function productIdToTier(productId: string | null): SubscriptionTier {
  if (!productId) return 'free';
  if (productId === TIERS.pro.product_id) return 'pro';
  if (productId === TIERS.portfolio.product_id) return 'portfolio';
  if (productId === TIERS.solo.product_id) return 'solo';
  return 'free';
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Primary: read from subscriptions table (set by webhook).
  //
  // The table is keyed by user_id — typically the ORG OWNER who paid Stripe.
  // Team members (members/admins/accountants/viewers added via invite) do not
  // have their own subscription row. Without peer lookup, every non-owner
  // teammate falls back to `tier='free'` and gets locked out of paid features
  // they should inherit from the org they belong to.
  const { data: subscription, isLoading } = useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: async () => {
      // 1. The user's own subscription row (org owners)
      const { data: ownSub, error: ownErr } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (ownErr) throw ownErr;
      if (ownSub && (ownSub.status === 'active' || ownSub.status === 'trialing')) {
        return ownSub;
      }

      // 2. Peer lookup — find any active subscription in any org the user is
      //    a member of. If a teammate (typically the owner) has an active
      //    plan, inherit its tier.
      const { data: memberships } = await supabase
        .from('memberships')
        .select('org_id')
        .eq('user_id', user!.id);

      const orgIds = (memberships ?? []).map((m: { org_id: string }) => m.org_id);
      if (orgIds.length === 0) return ownSub ?? null;

      const { data: peers } = await supabase
        .from('memberships')
        .select('user_id')
        .in('org_id', orgIds);

      const peerIds = Array.from(
        new Set((peers ?? []).map((p: { user_id: string }) => p.user_id))
      ).filter((id) => id !== user!.id);

      if (peerIds.length === 0) return ownSub ?? null;

      const { data: peerSub } = await supabase
        .from('subscriptions')
        .select('*')
        .in('user_id', peerIds)
        .in('status', ['active', 'trialing'])
        .order('current_period_end', { ascending: false })
        .limit(1)
        .maybeSingle();

      return peerSub ?? ownSub ?? null;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  // Listen for realtime updates from webhook writes
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('subscription-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'subscriptions',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['subscription', user.id] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient]);

  // Manual fallback: call check-subscription edge function (used after checkout redirect)
  const checkSubscription = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase.functions.invoke('check-subscription');
      if (error) throw error;

      // If the edge function returns data, also write to cache so UI updates immediately
      if (data) {
        queryClient.setQueryData(['subscription', user.id], {
          user_id: user.id,
          status: data?.subscribed ? 'active' : 'inactive',
          product_id: data?.product_id ?? null,
          price_id: null,
          current_period_end: data?.subscription_end ?? null,
        });
      }
    } catch (err) {
      console.error('Failed to check subscription:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to check subscription status');
    }
  }, [user, queryClient]);

  const tier = productIdToTier(subscription?.product_id ?? null);
  const subscribed = subscription?.status === 'active' || subscription?.status === 'trialing';

  const state: SubscriptionState = {
    subscribed,
    tier,
    productId: subscription?.product_id ?? null,
    subscriptionEnd: subscription?.current_period_end ?? null,
    loading: isLoading,
  };

  const hasFeature = useCallback((feature: FeatureFlag): boolean => {
    return TIER_FEATURES[tier].includes(feature);
  }, [tier]);

  const propertyLimit = TIER_PROPERTY_LIMITS[tier];
  const documentLimit = TIER_DOCUMENT_LIMITS[tier];

  return (
    <SubscriptionContext.Provider value={{ ...state, checkSubscription, hasFeature, propertyLimit, documentLimit }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (!context) throw new Error('useSubscription must be used within SubscriptionProvider');
  return context;
}
