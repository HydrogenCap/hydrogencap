import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from "sonner";

export interface LocationInsights {
  locationSummary: string;
  concentrationRisk: {
    level: 'low' | 'medium' | 'high';
    explanation: string;
  };
  localAuthorityInsights: Array<{
    authority: string;
    insight: string;
    impact: 'positive' | 'neutral' | 'negative';
  }>;
  marketContext: Array<{
    area: string;
    trend: string;
    recommendation: string;
  }>;
  externalRisks: Array<{
    risk: string;
    affectedProperties: string[];
    mitigation: string;
  }>;
  opportunities: Array<{
    opportunity: string;
    rationale: string;
  }>;
}

interface PropertyLocation {
  address: string;
  postcode: string;
  postcodeArea: string;
  areaName: string;
  localAuthority: string;
  latitude?: number;
  longitude?: number;
  epcRating?: string;
  councilTaxBand?: string;
  propertyType?: string;
  beds?: number;
  currentValue?: number;
  annualRent?: number;
}

export function useLocationAI() {
  const [insights, setInsights] = useState<LocationInsights | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generateInsights = useCallback(async (
    properties: PropertyLocation[],
    portfolioSummary: string
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('portfolio-location-insights', {
        body: { properties, portfolioSummary },
      });

      if (fnError) {
        throw fnError;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      if (data?.insights) {
        setInsights(data.insights);
        return data.insights;
      }

      throw new Error('No insights returned');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate location insights';
      setError(message);
      
      if (message.includes('Rate limit')) {
        toast.error('Rate Limit Exceeded', { description: 'Please wait a moment and try again.' });
      } else if (message.includes('credits')) {
        toast.error('AI Credits Exhausted', { description: 'Please add credits to continue using AI insights.' });
      } else {
        toast.error('Location AI Error', { description: message });
      }
      
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setInsights(null);
    setError(null);
  }, []);

  return {
    insights,
    isLoading,
    error,
    generateInsights,
    reset,
  };
}
