import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePropertyWithFeatures } from './useComplianceRequirements';
import { usePropertyCompliance } from './useCompliance';
import { toast } from 'sonner';
import { logError } from '@/lib/errorLogger';

export interface AIComplianceRequirement {
  type: string;
  required: boolean;
  reason: string;
  status: 'valid' | 'expiring_soon' | 'expired' | 'missing' | 'not_required';
  priority: 'high' | 'medium' | 'low';
  recommendation: string;
}

export interface AIComplianceInsight {
  title: string;
  description: string;
  type: 'warning' | 'info' | 'suggestion';
  actionable: boolean;
}

export interface AIComplianceCostEstimate {
  immediate: string;
  annual: string;
  details: string[];
}

export interface AIComplianceAnalysis {
  analysis: {
    summary: string;
    complianceScore: number;
    urgentActions: number;
  };
  requirements: AIComplianceRequirement[];
  insights: AIComplianceInsight[];
  costEstimate: AIComplianceCostEstimate;
  generatedAt: string;
}

type AnalysisMode = 'analyze' | 'quick' | 'audit';
type PortfolioPropertyData = Record<string, unknown>;
type PortfolioComplianceItem = Record<string, unknown>;

export function useAIComplianceChecker(propertyId: string | undefined) {
  const [lastAnalysis, setLastAnalysis] = useState<AIComplianceAnalysis | null>(null);
  
  const { data: propertyData, isLoading: loadingProperty } = usePropertyWithFeatures(propertyId);
  const { data: complianceItems, isLoading: loadingCompliance } = usePropertyCompliance(propertyId);

  const analyzeCompliance = useMutation({
    mutationFn: async ({ mode = 'analyze' }: { mode?: AnalysisMode }) => {
      if (!propertyData) {
        throw new Error('Property data not available');
      }

      const { data, error } = await supabase.functions.invoke('ai-compliance-checker', {
        body: {
          propertyId,
          propertyData,
          complianceItems: complianceItems || [],
          mode,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return data as AIComplianceAnalysis;
    },
    onSuccess: (data) => {
      setLastAnalysis(data);
      toast.success('AI compliance analysis complete');
    },
    onError: (error: Error) => {
      console.error('AI Compliance analysis error:', error);
      logError({ source: 'useAIComplianceChecker.analyzeCompliance', message: 'AI compliance checker edge function failed', severity: 'error', error });
      if (error.message.includes('Rate limit')) {
        toast.error('Rate limit exceeded. Please try again in a moment.');
      } else if (error.message.includes('credits')) {
        toast.error('AI credits exhausted. Please add credits to continue.');
      } else {
        toast.error('Failed to analyze compliance. Please try again.');
      }
    },
  });

  const runAnalysis = useCallback((mode: AnalysisMode = 'analyze') => {
    if (!propertyData) {
      toast.error('Property data not loaded yet');
      return;
    }
    analyzeCompliance.mutate({ mode });
  }, [propertyData, analyzeCompliance]);

  const getHighPriorityItems = useCallback(() => {
    if (!lastAnalysis) return [];
    return lastAnalysis.requirements.filter(r => r.priority === 'high' && r.required);
  }, [lastAnalysis]);

  const getMissingItems = useCallback(() => {
    if (!lastAnalysis) return [];
    return lastAnalysis.requirements.filter(r => r.status === 'missing' && r.required);
  }, [lastAnalysis]);

  const getExpiringItems = useCallback(() => {
    if (!lastAnalysis) return [];
    return lastAnalysis.requirements.filter(r => 
      (r.status === 'expiring_soon' || r.status === 'expired') && r.required
    );
  }, [lastAnalysis]);

  const getActionableInsights = useCallback(() => {
    if (!lastAnalysis) return [];
    return lastAnalysis.insights.filter(i => i.actionable);
  }, [lastAnalysis]);

  return {
    analysis: lastAnalysis,
    isLoading: loadingProperty || loadingCompliance,
    isAnalyzing: analyzeCompliance.isPending,
    runAnalysis,
    getHighPriorityItems,
    getMissingItems,
    getExpiringItems,
    getActionableInsights,
    canAnalyze: !!propertyData && !loadingProperty && !loadingCompliance,
  };
}

// Hook for portfolio-wide AI compliance analysis
export function usePortfolioAIComplianceChecker() {
  const [analyses, setAnalyses] = useState<Map<string, AIComplianceAnalysis>>(new Map());

  const analyzeProperty = useCallback(async (
    propertyId: string,
    propertyData: PortfolioPropertyData,
    complianceItems: PortfolioComplianceItem[]
  ): Promise<AIComplianceAnalysis> => {
    const { data, error } = await supabase.functions.invoke('ai-compliance-checker', {
      body: {
        propertyId,
        propertyData,
        complianceItems,
        mode: 'quick',
      },
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);

    const analysis = data as AIComplianceAnalysis;
    setAnalyses(prev => new Map(prev).set(propertyId, analysis));
    return analysis;
  }, []);

  const getAnalysis = useCallback((propertyId: string) => {
    return analyses.get(propertyId);
  }, [analyses]);

  const clearAnalyses = useCallback(() => {
    setAnalyses(new Map());
  }, []);

  return {
    analyses,
    analyzeProperty,
    getAnalysis,
    clearAnalyses,
  };
}
