import { Info, Receipt, Calculator, TrendingDown, TrendingUp, PoundSterling } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTaxDashboardState } from './hooks/useTaxDashboardState';
import { TaxHeader } from './components/TaxHeader';
import { TaxProfileCard } from './components/TaxProfileCard';
import { KpiCard } from './components/KpiCard';
import { OverviewTab } from './components/OverviewTab';
import { SA105Tab } from './components/SA105Tab';
import { CGTTab } from './components/CGTTab';
import { fmt, pct } from './utils/format';

export default function TaxDashboard() {
  const s = useTaxDashboardState();

  return (
    <AppLayout>
      <div className="space-y-6">
        <TaxHeader taxYear={s.taxYear} setTaxYear={s.setTaxYear} taxYears={s.taxYears} />

        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 flex items-start gap-2 text-sm text-destructive">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <span>Estimates only — consult a qualified accountant for tax advice.</span>
        </div>

        <TaxProfileCard
          taxpayerType={s.taxpayerType}
          setTaxpayerType={s.setTaxpayerType}
          otherIncome={s.otherIncome}
          setOtherIncome={s.setOtherIncome}
          personalAllowance={s.personalAllowance}
          setPersonalAllowance={s.setPersonalAllowance}
          handleSaveProfile={s.handleSaveProfile}
          isPending={s.upsertProfile.isPending}
        />

        {s.isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Calculating...</div>
        ) : !s.calculation ? (
          <div className="text-center py-12 text-muted-foreground">No property data for {s.taxYear}</div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard icon={PoundSterling} label="Total Property Income" value={fmt(s.calculation.sa105.totalRents)} />
              <KpiCard icon={Receipt} label="Tax Liability" value={fmt(s.calculation.totalTaxLiability)} accent />
              <KpiCard
                icon={s.s24Additional > 0 ? TrendingDown : TrendingUp}
                label="Section 24 Impact"
                value={s.s24Additional > 0 ? `+${fmt(s.s24Additional)}` : fmt(0)}
                destructive={s.s24Additional > 0}
              />
              <KpiCard icon={Calculator} label="Effective Tax Rate" value={pct(s.calculation.effectiveTaxRate)} />
            </div>

            <Tabs value={s.activeTab} onValueChange={s.setActiveTab}>
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="sa105">SA105</TabsTrigger>
              <TabsTrigger value="cgt">Capital Gains</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-6 space-y-6">
              <OverviewTab calculation={s.calculation} s24ChartData={s.s24ChartData} s24Additional={s.s24Additional} />
            </TabsContent>

            <TabsContent value="sa105" className="mt-6 space-y-6">
              <SA105Tab calculation={s.calculation} />
            </TabsContent>

            <TabsContent value="cgt" className="mt-6 space-y-6">
              <CGTTab calculation={s.calculation} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppLayout>
  );
}
