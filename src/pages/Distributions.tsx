import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Banknote, TrendingUp, Calendar, Users } from 'lucide-react';
import { useDistributionRuns } from '@/hooks/useDistributionWorkflow';
import { DistributionWizard } from '@/components/distributions/DistributionWizard';
import { DistributionHistory } from '@/components/distributions/DistributionHistory';
import { formatGBP, formatGBPCompact } from '@/lib/calculations';
import { LoadingState } from '@/components/common/LoadingState';

function getNextQuarterDue(): string {
  const now = new Date();
  const _q = Math.floor(now.getMonth() / 3);
  const year = now.getFullYear();
  const quarterEnds = [
    new Date(year, 2, 31), // Q1 end
    new Date(year, 5, 30), // Q2 end
    new Date(year, 8, 30), // Q3 end
    new Date(year, 11, 31), // Q4 end
  ];

  // Find the next quarter end that hasn't passed
  for (let i = 0; i < 4; i++) {
    if (quarterEnds[i] > now) {
      return `Q${i + 1} ${year}`;
    }
  }
  return `Q1 ${year + 1}`;
}

export default function Distributions() {
  const { data: runs, isLoading } = useDistributionRuns();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [resumeRunId, setResumeRunId] = useState<string | null>(null);

  // KPI calculations
  const kpis = useMemo(() => {
    if (!runs?.length) {
      return { ytdDistributed: 0, nextDue: getNextQuarterDue(), avgPerInvestor: 0, activeRuns: 0 };
    }

    const currentYear = new Date().getFullYear();
    const ytdRuns = runs.filter(r => {
      const year = new Date(r.period_start).getFullYear();
      return year === currentYear && (r.status === 'completed' || r.status === 'approved');
    });

    const ytdDistributed = ytdRuns.reduce((s, r) => s + r.total_distributed, 0);

    // Count active/draft runs
    const activeRuns = runs.filter(r =>
      r.status === 'draft' || r.status === 'review' || r.status === 'approved' || r.status === 'processing'
    ).length;

    // Approximate avg per investor (total distributed / estimated investor count)
    // We use a rough count from completed runs
    const completedRuns = runs.filter(r => r.status === 'completed' || r.status === 'approved');
    const avgPerInvestor = completedRuns.length > 0
      ? ytdDistributed / Math.max(1, completedRuns.length)
      : 0;

    return {
      ytdDistributed,
      nextDue: getNextQuarterDue(),
      avgPerInvestor,
      activeRuns,
    };
  }, [runs]);

  // Separate active/draft distributions from completed ones
  const activeDrafts = useMemo(() => {
    if (!runs) return [];
    return runs.filter(r =>
      r.status === 'draft' || r.status === 'review' || r.status === 'processing'
    );
  }, [runs]);

  const handleResumeRun = (runId: string) => {
    setResumeRunId(runId);
    setWizardOpen(true);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Distributions</h1>
            <p className="text-muted-foreground">Quarterly profit distributions to investors</p>
          </div>
          <Button onClick={() => { setResumeRunId(null); setWizardOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" /> New Distribution
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-success" />
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Distributed YTD</p>
              </div>
              <p className="text-2xl font-bold">{formatGBPCompact(kpis.ytdDistributed)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="h-4 w-4 text-primary" />
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Next Due</p>
              </div>
              <p className="text-2xl font-bold">{kpis.nextDue}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-4 w-4 text-amber-500" />
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Avg Per Run</p>
              </div>
              <p className="text-2xl font-bold">{formatGBPCompact(kpis.avgPerInvestor)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Banknote className="h-4 w-4 text-primary" />
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Active Runs</p>
              </div>
              <p className="text-2xl font-bold">{kpis.activeRuns}</p>
            </CardContent>
          </Card>
        </div>

        {isLoading ? (
          <LoadingState text="Loading distributions..." />
        ) : (
          <>
            {/* Active/Draft Distributions */}
            {activeDrafts.length > 0 && (
              <Card className="border-primary/30">
                <CardContent className="pt-4">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Badge variant="secondary">{activeDrafts.length}</Badge>
                    Active / Draft Distributions
                  </h3>
                  <div className="space-y-2">
                    {activeDrafts.map(run => (
                      <div
                        key={run.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => handleResumeRun(run.id)}
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-medium">{run.period}</span>
                          <Badge variant="secondary">{run.status}</Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="font-mono">{formatGBP(run.total_distributed)}</span>
                          <Button size="sm" variant="outline">Continue</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Distribution History */}
            {runs && runs.length > 0 ? (
              <DistributionHistory />
            ) : (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <Banknote className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No distributions yet. Create your first quarterly distribution.</p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      {/* Distribution Wizard */}
      <DistributionWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        existingRunId={resumeRunId}
      />
    </AppLayout>
  );
}
