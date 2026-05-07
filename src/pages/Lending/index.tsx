import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { AppLayout } from '@/components/layout/AppLayout';
import { AlertCircle, AlertTriangle, TrendingUp, ArrowUpRight } from 'lucide-react';
import { RateExpiryDashboard } from '@/components/lending/RateExpiryDashboard';
import { ApplicationTracker } from '@/components/lending/ApplicationTracker';
import { LoanStressTest } from '@/components/lending/LoanStressTest';
import { RefinanceComparison } from '@/components/lending/RefinanceComparison';
import { useLendingState } from './hooks/useLendingState';
import { StatsBar } from './components/StatsBar';
import { LenderExposureCard } from './components/LenderExposureCard';
import { AlertSection } from './components/AlertSection';
import {
  RefinanceTimelineCard, CovenantMonitorCard, RateSensitivityCard,
} from './components/PortfolioTables';
import { SEO } from '@/components/SEO';

export default function Lending() {
  const s = useLendingState();

  if (s.isLoading) {
    return <AppLayout><div className="space-y-6"><Skeleton className="h-10 w-64" /><Skeleton className="h-40 w-full" /></div></AppLayout>;
  }

  return (
    <AppLayout>
      <SEO title="Lending — TenureIQ" description="Monitor every facility, LTV, and rate across your lenders in one place." />
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Lending</h1>

        <StatsBar
          totalDebt={s.totalDebt}
          weightedRate={s.weightedRate}
          totalMonthly={s.totalMonthly}
          fixedBalance={s.fixedBalance}
          variableBalance={s.variableBalance}
          fixedPct={s.fixedPct}
          variablePct={s.variablePct}
        />

        <Tabs value={s.activeTab} onValueChange={s.setActiveTab}>
          <TabsList>
            <TabsTrigger value="portfolio">Portfolio Debt</TabsTrigger>
            <TabsTrigger value="rate-expiries">
              Rate Expiries
            </TabsTrigger>
            <TabsTrigger value="applications">
              Applications
              {s.activeApplications.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 text-xs px-1.5 py-0">
                  {s.activeApplications.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="stress-test">Stress Test</TabsTrigger>
          </TabsList>

          {/* Portfolio Debt Tab */}
          <TabsContent value="portfolio" className="space-y-6">
            {s.refinanceFacility && (
              <RefinanceComparison
                facility={s.refinanceFacility}
                onApplicationCreated={() => {
                  s.setRefinanceFacilityId(null);
                  s.setActiveTab('applications');
                }}
              />
            )}

            <LenderExposureCard debtSummary={s.debtSummary} totalDebt={s.totalDebt} />

            {(s.criticalAlerts.length > 0 || s.warningAlerts.length > 0 || s.opportunityAlerts.length > 0) && (
              <Card>
                <CardHeader><CardTitle>Lending Alerts</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {s.criticalAlerts.length > 0 && <AlertSection title="Critical" alerts={s.criticalAlerts} icon={AlertCircle} color="text-red-600 dark:text-red-400" bgColor="bg-red-50 dark:bg-red-950/20" />}
                  {s.warningAlerts.length > 0 && <AlertSection title="Warning" alerts={s.warningAlerts} icon={AlertTriangle} color="text-amber-600 dark:text-amber-400" bgColor="bg-amber-50 dark:bg-amber-950/20" />}
                  {s.opportunityAlerts.length > 0 && <AlertSection title="Opportunities" alerts={s.opportunityAlerts} icon={TrendingUp} color="text-emerald-600 dark:text-emerald-400" bgColor="bg-emerald-50 dark:bg-emerald-950/20" />}
                </CardContent>
              </Card>
            )}

            <RefinanceTimelineCard activeFacilities={s.activeFacilities} />
            <CovenantMonitorCard activeFacilities={s.activeFacilities} />
            <RateSensitivityCard
              variableFacilities={s.variableFacilities}
              variableTotal={s.variableTotal}
              totalMonthly={s.totalMonthly}
              rateImpact1={s.rateImpact1}
              rateImpact2={s.rateImpact2}
            />
          </TabsContent>

          {/* Rate Expiries Tab */}
          <TabsContent value="rate-expiries">
            <RateExpiryDashboard onStartRefinance={s.handleStartRefinance} />
          </TabsContent>

          {/* Applications Tab */}
          <TabsContent value="applications" className="space-y-4">
            {s.activeApplications.length === 0 && s.completedApplications.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <ArrowUpRight className="h-10 w-10 text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-1">No mortgage applications</h3>
                  <p className="text-muted-foreground text-sm">
                    Start a refinance from the Rate Expiries tab or use the comparison tool.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                {s.activeApplications.length > 0 && (
                  <div className="space-y-4">
                    <h2 className="text-sm font-medium text-muted-foreground">
                      Active Applications ({s.activeApplications.length})
                    </h2>
                    {s.activeApplications.map((app) => (
                      <ApplicationTracker key={app.id} application={app} />
                    ))}
                  </div>
                )}
                {s.completedApplications.length > 0 && (
                  <div className="space-y-4">
                    <h2 className="text-sm font-medium text-muted-foreground">
                      Completed / Withdrawn ({s.completedApplications.length})
                    </h2>
                    {s.completedApplications.map((app) => (
                      <ApplicationTracker key={app.id} application={app} />
                    ))}
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* Stress Test Tab */}
          <TabsContent value="stress-test">
            <LoanStressTest />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
