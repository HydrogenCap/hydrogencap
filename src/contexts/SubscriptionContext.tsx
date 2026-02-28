import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

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
// They are safe to include in client-side code
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
  const [state, setState] = useState<SubscriptionState>({
    subscribed: false,
    tier: 'free',
    productId: null,
    subscriptionEnd: null,
    loading: true,
  });

  const checkSubscription = useCallback(async () => {
    if (!user) {
      setState({ subscribed: false, tier: 'free', productId: null, subscriptionEnd: null, loading: false });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('check-subscription');
      if (error) throw error;

      const tier = productIdToTier(data?.product_id);
      setState({
        subscribed: data?.subscribed ?? false,
        tier,
        productId: data?.product_id ?? null,
        subscriptionEnd: data?.subscription_end ?? null,
        loading: false,
      });
    } catch (err) {
      console.error('Failed to check subscription:', err);
      setState(prev => ({ ...prev, loading: false }));
    }
  }, [user]);

  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  useEffect(() => {
    if (!user) return;
    const interval = setInterval(checkSubscription, 60_000);
    return () => clearInterval(interval);
  }, [user, checkSubscription]);

  const hasFeature = useCallback((feature: FeatureFlag): boolean => {
    return TIER_FEATURES[state.tier].includes(feature);
  }, [state.tier]);

  const propertyLimit = TIER_PROPERTY_LIMITS[state.tier];
  const documentLimit = TIER_DOCUMENT_LIMITS[state.tier];

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
