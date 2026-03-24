import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Database } from '@/integrations/supabase/types';

type PortalInvestor = Database['public']['Tables']['investors']['Row'];
type PortalCommitment = Database['public']['Views']['investor_commitment_detail']['Row'];
type PortalDistribution = Database['public']['Tables']['investor_distributions']['Row'];
type PortalReturnMetric = Database['public']['Views']['investor_return_metrics']['Row'];
type PortalReport = Database['public']['Tables']['investor_reports']['Row'];

interface PortalInvestorDataResponse {
  investor: PortalInvestor | null;
  commitments: PortalCommitment[];
  distributions: PortalDistribution[];
  return_metrics: PortalReturnMetric[];
  reports: PortalReport[];
}

const EMPTY_PORTAL_INVESTOR_DATA: PortalInvestorDataResponse = {
  investor: null,
  commitments: [],
  distributions: [],
  return_metrics: [],
  reports: [],
};

export function usePortalInvestorData() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['portal-investor-data', user?.id],
    queryFn: async (): Promise<PortalInvestorDataResponse> => {
      if (!user?.id) return EMPTY_PORTAL_INVESTOR_DATA;

      const { data, error } = await supabase.rpc('get_portal_investor_data');
      if (error) throw error;

      const result = data as Partial<PortalInvestorDataResponse> | null;

      return {
        investor: result?.investor ?? null,
        commitments: Array.isArray(result?.commitments) ? (result.commitments as PortalCommitment[]) : [],
        distributions: Array.isArray(result?.distributions) ? (result.distributions as PortalDistribution[]) : [],
        return_metrics: Array.isArray(result?.return_metrics)
          ? (result.return_metrics as PortalReturnMetric[])
          : [],
        reports: Array.isArray(result?.reports) ? (result.reports as PortalReport[]) : [],
      };
    },
    enabled: !!user?.id,
  });

  const investor = data?.investor ?? null;
  const investorId = investor?.id;
  const commitments = data?.commitments ?? [];
  const distributions = data?.distributions ?? [];
  const returnMetrics = data?.return_metrics ?? [];
  const reports = data?.reports ?? [];

  // Aggregate stats
  const totalCommitted = commitments?.reduce((s, c) => s + (c.committed_amount || 0), 0) || 0;
  const totalDrawn = commitments?.reduce((s, c) => s + (c.drawn_amount || 0), 0) || 0;
  const totalDistributed = distributions?.filter(d => d.status === 'paid').reduce((s, d) => s + (d.amount || 0), 0) || 0;
  const totalEquityValue = returnMetrics?.reduce((s, m) => s + (m.current_equity_value || 0), 0) || 0;
  const weightedMultiple = returnMetrics?.length
    ? returnMetrics.reduce((s, m) => s + (m.equity_multiple || 0) * (m.capital_invested || 0), 0) /
      Math.max(returnMetrics.reduce((s, m) => s + (m.capital_invested || 0), 0), 1)
    : 0;

  return {
    investor,
    isInvestorUser: !!investor,
    investorId,
    commitments,
    distributions,
    returnMetrics,
    reports,
    isLoading,
    stats: {
      totalCommitted,
      totalDrawn,
      totalDistributed,
      totalEquityValue,
      weightedMultiple,
    },
  };
}
