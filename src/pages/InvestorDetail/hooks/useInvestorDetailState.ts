import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useInvestors, useSendInvestorPortalAccessEmail } from '@/hooks/useInvestors';
import { useInvestorCommitments, useInvestorDistributions, useInvestorReturnMetrics } from '@/hooks/useInvestorDetail';
import { useInvestorReports } from '@/hooks/useInvestorReports';
import { useDownloadFile } from '@/hooks/useSignedUrl';
import { COMMITMENT_TYPE_LABEL } from '../utils/badges';

export function useInvestorDetailState() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: investors, isLoading: investorsLoading } = useInvestors();
  const { data: commitments, isLoading: commitmentsLoading } = useInvestorCommitments(id);
  const { data: distributions } = useInvestorDistributions(id);
  const { data: returnMetrics } = useInvestorReturnMetrics(id);
  const { data: reports } = useInvestorReports(id);
  const { download: downloadInvestorReport, downloading: downloadingInvestorReport } = useDownloadFile('investor-reports');
  const sendPortalAccessEmail = useSendInvestorPortalAccessEmail();

  const [activeTab, setActiveTab] = useState('overview');
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCommitmentModal, setShowCommitmentModal] = useState(false);
  const [showDistributionModal, setShowDistributionModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  const investor = useMemo(() => investors?.find(i => i.id === id), [investors, id]);

  const kpis = useMemo(() => {
    const totalCommitted = commitments?.reduce((s, c) => s + (c.committed_amount || 0), 0) || 0;
    const totalDrawn = commitments?.reduce((s, c) => s + (c.drawn_amount || 0), 0) || 0;
    const totalEquityValue = returnMetrics?.reduce((s, m) => s + (m.current_equity_value || 0), 0) || 0;
    const totalDistributed = distributions?.filter(d => d.status === 'paid').reduce((s, d) => s + d.amount, 0) || 0;
    const weightedMultiple = returnMetrics?.length
      ? returnMetrics.reduce((s, m) => s + (m.equity_multiple || 0) * (m.capital_invested || 0), 0) /
        Math.max(returnMetrics.reduce((s, m) => s + (m.capital_invested || 0), 0), 1)
      : 0;
    return { totalCommitted, totalDrawn, totalEquityValue, totalDistributed, weightedMultiple };
  }, [commitments, distributions, returnMetrics]);

  const distStats = useMemo(() => {
    if (!distributions) return { allTime: 0, thisYear: 0, lastYear: 0, yield: 0 };
    const paid = distributions.filter(d => d.status === 'paid');
    const thisYear = new Date().getFullYear();
    const allTime = paid.reduce((s, d) => s + d.amount, 0);
    const thisYearTotal = paid.filter(d => new Date(d.distribution_date).getFullYear() === thisYear).reduce((s, d) => s + d.amount, 0);
    const lastYearTotal = paid.filter(d => new Date(d.distribution_date).getFullYear() === thisYear - 1).reduce((s, d) => s + d.amount, 0);
    const yieldPct = kpis.totalDrawn > 0 ? (thisYearTotal / kpis.totalDrawn * 100) : 0;
    return { allTime, thisYear: thisYearTotal, lastYear: lastYearTotal, yield: yieldPct };
  }, [distributions, kpis.totalDrawn]);

  const commitmentOptions = useMemo(() =>
    (commitments || []).map(c => ({
      id: c.commitment_id!,
      entity_name: c.entity_name || '',
      commitment_type: COMMITMENT_TYPE_LABEL[c.commitment_type || ''] || c.commitment_type || '',
      entity_id: c.entity_id!,
    })),
    [commitments]
  );

  return {
    id, navigate,
    investors, investorsLoading,
    commitments, commitmentsLoading,
    distributions, returnMetrics, reports,
    downloadInvestorReport, downloadingInvestorReport,
    sendPortalAccessEmail,
    activeTab, setActiveTab,
    showEditModal, setShowEditModal,
    showCommitmentModal, setShowCommitmentModal,
    showDistributionModal, setShowDistributionModal,
    showReportModal, setShowReportModal,
    investor, kpis, distStats, commitmentOptions,
  };
}
