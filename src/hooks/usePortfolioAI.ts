import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from "sonner";

export interface AIInsights {
  overview: string;
  priorities: { text: string; reason: string }[];
  risks: { text: string; reason: string; filterType?: string }[];
  opportunities: { text: string; reason: string; filterType?: string }[];
}

export function usePortfolioAI() {
  const [insights, setInsights] = useState<AIInsights | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generateInsights = useCallback(async (portfolioData: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('portfolio-insights', {
        body: { portfolioData },
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
      const message = err instanceof Error ? err.message : 'Failed to generate insights';
      setError(message);
      
      // Show specific error toasts
      if (message.includes('Rate limit')) {
        toast.error('Rate Limit Exceeded', { description: 'Please wait a moment and try again.' });
      } else if (message.includes('credits')) {
        toast.error('AI Credits Exhausted', { description: 'Please add credits to continue using AI insights.' });
      } else {
        toast.error('AI Error', { description: message });
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
