import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseAny } from '@/integrations/supabase/client';
import { fetchUserOrgId } from './useUserOrg';
import { toast } from "sonner";

export interface ContributingFactor {
  factor: string;
  weight: number;
}

export interface ArrearsPrediction {
  id: string;
  org_id: string;
  tenant_id: string | null;
  property_id: string;
  room_id: string | null;
  risk_score: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  contributing_factors: ContributingFactor[];
  recommended_actions: string[];
  prediction_period: string;
  model_version: string;
  created_at: string;
}

export interface ArrearsRiskSummary {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  avgRiskScore: number;
  lastRunAt: string | null;
}

const PREDICTIONS_KEY = 'arrears-predictions';

export function useArrearsPredictions(propertyId?: string) {
  return useQuery({
    queryKey: [PREDICTIONS_KEY, propertyId],
    queryFn: async () => {
      const orgId = await fetchUserOrgId();

      let query = supabaseAny
        .from('arrears_predictions')
        .select('*')
        .eq('org_id', orgId)
        .order('risk_score', { ascending: false });

      if (propertyId) {
        query = query.eq('property_id', propertyId);
      }

      const { data, error } = await query;
      if (error) throw error;

      type Row = Omit<ArrearsPrediction, 'risk_score' | 'contributing_factors' | 'recommended_actions'> & {
        risk_score: number | string;
        contributing_factors: unknown;
        recommended_actions: unknown;
      };
      return ((data ?? []) as Row[]).map((row) => ({
        ...row,
        risk_score: Number(row.risk_score),
        contributing_factors: Array.isArray(row.contributing_factors)
          ? (row.contributing_factors as ContributingFactor[])
          : [],
        recommended_actions: Array.isArray(row.recommended_actions)
          ? (row.recommended_actions as string[])
          : [],
      })) as ArrearsPrediction[];
    },
  });
}

export function useRunArrearsPrediction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (propertyId?: string) => {
      const body: Record<string, unknown> = {};
      if (propertyId) body.property_id = propertyId;

      const { data, error } = await supabaseAny.functions.invoke('predict-arrears', { body });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [PREDICTIONS_KEY] });
      toast.success('Arrears prediction complete', { description: `Analysed ${data?.summary?.total ?? 0} tenants. ${data?.summary?.critical ?? 0} critical, ${data?.summary?.high ?? 0} high risk.` });
    },
    onError: (error: Error) => {
      toast.error('Prediction failed', { description: error.message || 'Failed to run arrears prediction' });
    },
  });
}

export function useArrearsRiskSummary() {
  return useQuery({
    queryKey: [PREDICTIONS_KEY, 'summary'],
    queryFn: async () => {
      const orgId = await fetchUserOrgId();

      const { data, error } = await supabaseAny
        .from('arrears_predictions')
        .select('risk_score, risk_level, created_at')
        .eq('org_id', orgId);

      if (error) throw error;

      const predictions = data ?? [];

      if (predictions.length === 0) {
        return {
          total: 0,
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
          avgRiskScore: 0,
          lastRunAt: null,
        } satisfies ArrearsRiskSummary;
      }

      type SummaryRow = { risk_score: number | string; risk_level: string; created_at: string };
      const rows = predictions as SummaryRow[];
      const scores = rows.map((p) => Number(p.risk_score));
      const avgRiskScore = scores.reduce((a, b) => a + b, 0) / scores.length;

      return {
        total: rows.length,
        critical: rows.filter((p) => p.risk_level === 'critical').length,
        high: rows.filter((p) => p.risk_level === 'high').length,
        medium: rows.filter((p) => p.risk_level === 'medium').length,
        low: rows.filter((p) => p.risk_level === 'low').length,
        avgRiskScore: Math.round(avgRiskScore * 100) / 100,
        lastRunAt: rows[0]?.created_at ?? null,
      } satisfies ArrearsRiskSummary;
    },
  });
}
