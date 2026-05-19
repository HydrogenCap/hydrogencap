import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  usePortfolioDebtSummary,
  useAllLoanFacilities,
  useLoanAlerts,
} from '@/hooks/useLoanFacilities';
import { useMortgageApplications } from '@/hooks/useRefinanceWorkflow';

const VALID_TABS = ['portfolio', 'rate-expiries', 'applications', 'stress-test'] as const;

export function useLendingState() {
  const { data: debtSummary = [], isLoading: loadingSummary } = usePortfolioDebtSummary();
  const { data: facilities = [], isLoading: loadingFacilities } = useAllLoanFacilities();
  const { data: alerts = [], isLoading: loadingAlerts } = useLoanAlerts();
  const { data: applications = [] } = useMortgageApplications();

  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (VALID_TABS as readonly string[]).includes(searchParams.get('tab') ?? '')
    ? (searchParams.get('tab') as string)
    : 'portfolio';
  const [activeTab, setActiveTabState] = useState<string>(initialTab);
  const [refinanceFacilityId, setRefinanceFacilityId] = useState<string | null>(null);

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t && (VALID_TABS as readonly string[]).includes(t) && t !== activeTab) {
      setActiveTabState(t);
    }
  }, [searchParams, activeTab]);

  const setActiveTab = (value: string) => {
    setActiveTabState(value);
    const next = new URLSearchParams(searchParams);
    if (value === 'portfolio') next.delete('tab');
    else next.set('tab', value);
    setSearchParams(next, { replace: true });
  };


  const activeFacilities = facilities.filter(f => f.status === 'active');
  const totalDebt = activeFacilities.reduce((s, f) => s + f.current_balance, 0);
  const weightedRate = totalDebt > 0
    ? activeFacilities.reduce((s, f) => s + f.interest_rate * f.current_balance, 0) / totalDebt
    : 0;
  const totalMonthly = activeFacilities.reduce((s, f) => s + (f.monthly_payment || 0), 0);
  const fixedBalance = activeFacilities.filter(f => f.rate_type === 'fixed').reduce((s, f) => s + f.current_balance, 0);
  const variableBalance = totalDebt - fixedBalance;
  const fixedPct = totalDebt > 0 ? (fixedBalance / totalDebt * 100).toFixed(0) : '0';
  const variablePct = totalDebt > 0 ? (variableBalance / totalDebt * 100).toFixed(0) : '0';

  // Rate sensitivity (variable facilities only)
  const variableFacilities = activeFacilities.filter(f => f.rate_type !== 'fixed');
  const variableTotal = variableFacilities.reduce((s, f) => s + f.current_balance, 0);
  const rateImpact1 = variableTotal * 0.01 / 12;
  const rateImpact2 = variableTotal * 0.02 / 12;

  // Categorise alerts
  const criticalAlerts = alerts.filter(a =>
    a.ltv_covenant_alert === 'covenant_breach' || a.term_alert === 'term_expired' || a.rate_alert === 'rate_expired'
  );
  const warningAlerts = alerts.filter(a =>
    a.rate_alert === 'rate_expiring_soon' || a.term_alert === 'term_ending_soon' || a.term_alert === 'term_ending_within_year' || a.ltv_covenant_alert === 'covenant_warning'
  );
  const opportunityAlerts = alerts.filter(a => a.erc_alert === 'erc_ending_soon');
  const rateAlertCount = alerts.filter(a => a.rate_alert === 'rate_expired' || a.rate_alert === 'rate_expiring_soon').length;



  const isLoading = loadingSummary || loadingFacilities || loadingAlerts;

  const activeApplications = applications.filter(
    (a) => a.status !== 'completed' && a.status !== 'withdrawn'
  );
  const completedApplications = applications.filter(
    (a) => a.status === 'completed' || a.status === 'withdrawn'
  );

  const refinanceFacility = refinanceFacilityId
    ? activeFacilities.find((f) => f.id === refinanceFacilityId) ?? null
    : null;

  const handleStartRefinance = (facilityId: string) => {
    setRefinanceFacilityId(facilityId);
    setActiveTab('portfolio');
  };

  return {
    debtSummary, facilities, alerts, applications,
    activeTab, setActiveTab, refinanceFacilityId, setRefinanceFacilityId,
    activeFacilities, totalDebt, weightedRate, totalMonthly,
    fixedBalance, variableBalance, fixedPct, variablePct,
    variableFacilities, variableTotal, rateImpact1, rateImpact2,
    criticalAlerts, warningAlerts, opportunityAlerts, rateAlertCount,
    isLoading, activeApplications, completedApplications,

    refinanceFacility, handleStartRefinance,
  };
}
