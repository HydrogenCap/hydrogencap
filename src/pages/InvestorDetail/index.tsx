import { Mail, FileText, Edit } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { MobileDetailsSheet } from '@/components/common';
import { InvestorFormModal } from '@/components/investors/InvestorFormModal';
import { CommitmentFormModal } from '@/components/investors/CommitmentFormModal';
import { DistributionFormModal } from '@/components/investors/DistributionFormModal';
import { InvestorReportModal } from '@/components/investors/InvestorReportModal';
import { KYCOnboardingPanel } from '@/components/investors/KYCOnboardingPanel';
import { CapitalCallManager } from '@/components/investors/CapitalCallManager';
import { InvestorPortalView } from '@/components/investors/InvestorPortalView';
import { useInvestorDetailState } from './hooks/useInvestorDetailState';
import { InvestorDetailSkeleton } from './components/InvestorDetailSkeleton';
import { InvestorHeader } from './components/InvestorHeader';
import { KpiRow } from './components/KpiRow';
import { CommitmentsCard } from './components/CommitmentsCard';
import { DistributionsCard } from './components/DistributionsCard';
import { ReturnMetricsCard } from './components/ReturnMetricsCard';
import { ReportHistoryCard } from './components/ReportHistoryCard';

export default function InvestorDetail() {
  const s = useInvestorDetailState();

  if (s.investorsLoading || s.commitmentsLoading) {
    return <InvestorDetailSkeleton />;
  }

  if (!s.investor) {
    return (
      <AppLayout>
        <div className="text-center py-16 text-muted-foreground">Investor not found.</div>
      </AppLayout>
    );
  }

  const investor = s.investor;
  const canSendPortalAccessEmail = Boolean(investor.portal_access_enabled && investor.email);

  return (
    <AppLayout>
      <div className="space-y-6 pb-24 lg:pb-0">
        <InvestorHeader
          investor={investor}
          onBack={() => s.navigate('/investors')}
          onEdit={() => s.setShowEditModal(true)}
          onShowReport={() => s.setShowReportModal(true)}
          onSendPortalAccess={() => void s.sendPortalAccessEmail.mutateAsync(investor.id)}
          canSendPortalAccess={canSendPortalAccessEmail}
          sendingPortalAccess={s.sendPortalAccessEmail.isPending}
        />

        <KpiRow kpis={s.kpis} />

        <Tabs value={s.activeTab} onValueChange={s.setActiveTab}>
          <TabsList className="overflow-x-auto max-w-full justify-start">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="kyc">KYC / AML</TabsTrigger>
            <TabsTrigger value="capital-calls">Capital Calls</TabsTrigger>
            <TabsTrigger value="portal">Portal Preview</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 mt-6">
            <CommitmentsCard commitments={s.commitments as any} onAdd={() => s.setShowCommitmentModal(true)} />
            <DistributionsCard distributions={s.distributions as any} distStats={s.distStats} onAdd={() => s.setShowDistributionModal(true)} />
            <ReturnMetricsCard returnMetrics={s.returnMetrics as any} />
            <ReportHistoryCard
              reports={s.reports as any}
              onGenerate={() => s.setShowReportModal(true)}
              downloadInvestorReport={s.downloadInvestorReport}
              downloading={s.downloadingInvestorReport}
            />
          </TabsContent>

          <TabsContent value="kyc" className="mt-6">
            <KYCOnboardingPanel investorId={s.id!} />
          </TabsContent>

          <TabsContent value="capital-calls" className="mt-6">
            <CapitalCallManager investorId={s.id} />
          </TabsContent>

          <TabsContent value="portal" className="mt-6">
            <InvestorPortalView investorId={s.id!} />
          </TabsContent>
        </Tabs>
      </div>

      <MobileDetailsSheet title="Investor Actions" triggerLabel="Actions">
        <div className="space-y-2">
          <Button variant="outline" className="w-full justify-start" onClick={() => s.setShowEditModal(true)}>
            <Edit className="h-4 w-4 mr-2" />Edit Investor
          </Button>
          <Button variant="outline" className="w-full justify-start" onClick={() => s.setShowReportModal(true)}>
            <FileText className="h-4 w-4 mr-2" />Generate Statement
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start"
            disabled={!canSendPortalAccessEmail || s.sendPortalAccessEmail.isPending}
            onClick={() => void s.sendPortalAccessEmail.mutateAsync(investor.id)}
          >
            <Mail className="h-4 w-4 mr-2" />Send Portal Access
          </Button>
        </div>
      </MobileDetailsSheet>

      <InvestorFormModal open={s.showEditModal} onOpenChange={s.setShowEditModal} investor={investor} />
      <CommitmentFormModal open={s.showCommitmentModal} onOpenChange={s.setShowCommitmentModal} investorId={s.id!} />
      <DistributionFormModal
        open={s.showDistributionModal}
        onOpenChange={s.setShowDistributionModal}
        investorId={s.id!}
        commitments={s.commitmentOptions}
      />
      {investor && (
        <InvestorReportModal
          open={s.showReportModal}
          onOpenChange={s.setShowReportModal}
          investor={investor}
          commitments={s.commitments || []}
          distributions={s.distributions || []}
          returnMetrics={s.returnMetrics || []}
        />
      )}
    </AppLayout>
  );
}
