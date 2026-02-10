import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type SubscriptionTier = 'free' | 'starter' | 'professional' | 'enterprise';

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
}

export type FeatureFlag =
  | 'ai_compliance_checker'
  | 'portfolio_chat'
  | 'passport_autofill'
  | 'ai_valuations'
  | 'reports_exports'
  | 'bank_presentation'
  | 'ownership_attribution'
  | 'company_secrets'
  | 'shareholder_portal'
  | 'unlimited_properties';

const TIERS = {
  starter: {
    product_id: 'prod_TxJdFT8No80v9S',
    price_id: 'price_1SzP0MAZFDMuITvQvU1ICh4p',
  },
  professional: {
    product_id: 'prod_TxJeOM05Pg5FWE',
    price_id: 'price_1SzP1KAZFDMuITvQ4pZv6t5R',
  },
  enterprise: {
    product_id: 'prod_TxJeGRcMMMPHwP',
    price_id: 'price_1SzP1aAZFDMuITvQsijsXgos',
  },
} as const;

export { TIERS };

const TIER_FEATURES: Record<SubscriptionTier, FeatureFlag[]> = {
  free: [],
  starter: [],
  professional: [
    'ai_compliance_checker',
    'ai_valuations',
    'reports_exports',
    'bank_presentation',
    'ownership_attribution',
  ],
  enterprise: [
    'ai_compliance_checker',
    'portfolio_chat',
    'passport_autofill',
    'ai_valuations',
    'reports_exports',
    'bank_presentation',
    'ownership_attribution',
    'company_secrets',
    'shareholder_portal',
    'unlimited_properties',
  ],
};

const TIER_PROPERTY_LIMITS: Record<SubscriptionTier, number> = {
  free: 3,
  starter: 10,
  professional: 50,
  enterprise: Infinity,
};

function productIdToTier(productId: string | null): SubscriptionTier {
  if (!productId) return 'free';
  if (productId === TIERS.enterprise.product_id) return 'enterprise';
  if (productId === TIERS.professional.product_id) return 'professional';
  if (productId === TIERS.starter.product_id) return 'starter';
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

  // Auto-refresh every 60s
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(checkSubscription, 60_000);
    return () => clearInterval(interval);
  }, [user, checkSubscription]);

  const hasFeature = useCallback((feature: FeatureFlag): boolean => {
    return TIER_FEATURES[state.tier].includes(feature);
  }, [state.tier]);

  const propertyLimit = TIER_PROPERTY_LIMITS[state.tier];

  return (
    <SubscriptionContext.Provider value={{ ...state, checkSubscription, hasFeature, propertyLimit }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (!context) throw new Error('useSubscription must be used within SubscriptionProvider');
  return context;
}
