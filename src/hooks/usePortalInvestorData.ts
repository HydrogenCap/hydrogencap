import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function usePortalInvestorData() {
  const { user } = useAuth();

  // Find investor record linked to this user
  const { data: investor, isLoading: investorLoading } = useQuery({
    queryKey: ['portal-investor', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('investors')
        .select('*')
        .eq('portal_user_id', user.id)
        .eq('portal_access_enabled', true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const investorId = investor?.id;

  // Commitments
  const { data: commitments, isLoading: commitmentsLoading } = useQuery({
    queryKey: ['portal-investor-commitments', investorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('investor_commitment_detail')
        .select('*')
        .eq('investor_id', investorId!);
      if (error) throw error;
      return data;
    },
    enabled: !!investorId,
  });

  // Distributions
  const { data: distributions, isLoading: distributionsLoading } = useQuery({
    queryKey: ['portal-investor-distributions', investorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('investor_distributions')
        .select('*')
        .eq('investor_id', investorId!)
        .order('distribution_date', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!investorId,
  });

  // Return metrics
  const { data: returnMetrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['portal-investor-return-metrics', investorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('investor_return_metrics')
        .select('*')
        .eq('investor_id', investorId!);
      if (error) throw error;
      return data;
    },
    enabled: !!investorId,
  });

  // Reports
  const { data: reports, isLoading: reportsLoading } = useQuery({
    queryKey: ['portal-investor-reports', investorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('investor_reports')
        .select('*')
        .eq('investor_id', investorId!)
        .order('generated_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!investorId,
  });

  const isLoading = investorLoading || commitmentsLoading || distributionsLoading || metricsLoading || reportsLoading;

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
