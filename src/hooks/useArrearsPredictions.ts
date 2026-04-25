import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, supabaseAny } from '@/integrations/supabase/client';
import { fetchUserOrgId } from './useUserOrg';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

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
  const { toast } = useToast();

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
      toast({
        title: 'Arrears prediction complete',
        description: `Analysed ${data?.summary?.total ?? 0} tenants. ${data?.summary?.critical ?? 0} critical, ${data?.summary?.high ?? 0} high risk.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Prediction failed',
        description: error.message || 'Failed to run arrears prediction',
        variant: 'destructive',
      });
    },
  });
}

// ── Predictions → Tasks ──────────────────────────────────────

const ARREARS_TASK_SOURCE = 'arrears-prediction';

const RISK_LEVEL_TO_PRIORITY: Record<string, string> = {
  critical: 'critical',
  high: 'high',
};

const ACTIVE_TASK_STATUSES = ['open', 'in_progress', 'waiting'];

export interface CreateTasksFromArrearsInput {
  predictions: ArrearsPrediction[];
}

export interface CreateTasksFromArrearsResult {
  created: number;
  skipped: number;
  total: number;
}

function isHighRisk(p: ArrearsPrediction): boolean {
  return p.risk_level === 'critical' || p.risk_level === 'high';
}

/**
 * Bulk-creates `tasks` rows from arrears predictions flagged as critical
 * or high risk. Dedupes against any active task already linked to the
 * same prediction (via source_wizard_id) so re-running the model and
 * re-clicking the button doesn't create duplicates.
 */
export function useCreateTasksFromArrearsRisk() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ predictions }: CreateTasksFromArrearsInput): Promise<CreateTasksFromArrearsResult> => {
      if (!user?.id) throw new Error('Not signed in');
      const orgId = await fetchUserOrgId();
      if (!orgId) throw new Error('No organisation in context');

      const candidates = predictions.filter(isHighRisk);
      if (candidates.length === 0) {
        return { created: 0, skipped: 0, total: 0 };
      }

      const predictionIds = candidates.map((p) => p.id);
      const { data: existingRows, error: lookupErr } = await supabaseAny
        .from('tasks')
        .select('source_wizard_id')
        .eq('org_id', orgId)
        .eq('source', ARREARS_TASK_SOURCE)
        .in('source_wizard_id', predictionIds)
        .in('status', ACTIVE_TASK_STATUSES);
      if (lookupErr) throw lookupErr;

      const existing = new Set(
        ((existingRows ?? []) as Array<{ source_wizard_id: string | null }>)
          .map((r) => r.source_wizard_id)
          .filter((v): v is string => !!v)
      );

      const toInsert = candidates
        .filter((p) => !existing.has(p.id))
        .map((p) => {
          const factors = p.contributing_factors
            .map((f) => f.factor)
            .slice(0, 3)
            .join(', ');
          const recs = p.recommended_actions.slice(0, 3).join(' · ');
          return {
            org_id: orgId,
            property_id: p.property_id,
            title: 'Contact tenant — high arrears risk',
            description: [
              `Predicted risk: ${Math.round(p.risk_score * 100)}% (${p.risk_level})`,
              factors ? `Factors: ${factors}` : null,
              recs ? `Suggested: ${recs}` : null,
            ]
              .filter(Boolean)
              .join('\n'),
            category: 'arrears',
            priority: RISK_LEVEL_TO_PRIORITY[p.risk_level] ?? 'high',
            status: 'open',
            source: ARREARS_TASK_SOURCE,
            source_wizard_id: p.id,
            created_by: user.id,
          };
        });

      if (toInsert.length > 0) {
        const { error: insertErr } = await supabase.from('tasks').insert(toInsert);
        if (insertErr) throw insertErr;
      }

      return {
        created: toInsert.length,
        skipped: candidates.length - toInsert.length,
        total: candidates.length,
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task-counts'] });
      if (result.created === 0 && result.skipped > 0) {
        toast({
          title: 'No new tasks created',
          description: `${result.skipped} task${result.skipped === 1 ? ' is' : 's are'} already open for these tenants.`,
        });
        return;
      }
      const skippedSuffix = result.skipped > 0 ? ` (${result.skipped} already open)` : '';
      toast({
        title: `Created ${result.created} task${result.created === 1 ? '' : 's'}`,
        description: `Find them in your Tasks list${skippedSuffix}.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to create tasks',
        description: error.message,
        variant: 'destructive',
      });
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
