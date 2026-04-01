import { useState } from 'react';
import { ArrowRight, CheckCircle2, Circle, AlertCircle, MinusCircle, Play, Loader2, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { AppLayout } from '@/components/layout/AppLayout';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { useMigrationStatus, useRunMigrationStep, useRunFullMigration } from '@/hooks/useMigration';
import { GapFillSection } from '@/components/migration/GapFillSection';
import type { MigrationStep, MigrationResult } from '@/lib/migrationTypes';
import { getStatusColor, getStatusLabel } from '@/lib/migrationTypes';

const STATUS_ICONS = {
  complete: CheckCircle2,
  partial: AlertCircle,
  not_started: Circle,
  skipped: MinusCircle,
};

const STATUS_BADGE_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  complete: 'default',
  partial: 'secondary',
  not_started: 'destructive',
  skipped: 'outline',
};

function MigrationCard({ step, onMigrate, isMigrating }: {
  step: MigrationStep;
  onMigrate: () => void;
  isMigrating: boolean;
}) {
  const Icon = STATUS_ICONS[step.status];
  const progress = step.v1Count > 0 ? Math.min(100, Math.round((step.v2Count / step.v1Count) * 100)) : 0;

  return (
    <Card className="border-border">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Icon className={`h-4 w-4 ${getStatusColor(step.status)}`} />
              <h3 className="font-medium text-sm">{step.title}</h3>
              <Badge variant={STATUS_BADGE_VARIANTS[step.status]} className="text-[10px] h-5">
                {getStatusLabel(step.status)}
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
              <span>{step.v1Count} in V1</span>
              <ArrowRight className="h-3 w-3" />
              <span>{step.v2Count} in V2</span>
            </div>
            <Progress value={progress} className="h-1.5" />
            <span className="text-[10px] text-muted-foreground mt-1 block">{progress}% migrated</span>
          </div>
          <Button
            size="sm"
            variant={step.status === 'complete' ? 'outline' : 'default'}
            onClick={onMigrate}
            disabled={isMigrating || step.status === 'skipped'}
            className="shrink-0"
          >
            {isMigrating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Play className="h-3 w-3 mr-1" />}
            {step.status === 'complete' ? 'Re-run' : 'Migrate'}
          </Button>
        </div>
        {step.result && (
          <div className="mt-3 p-2 bg-muted/50 rounded text-xs space-y-0.5">
            <div className="text-success">✓ {step.result.migrated} migrated</div>
            {step.result.skipped_already_exists !== undefined && step.result.skipped_already_exists > 0 && (
              <div className="text-muted-foreground">↳ {step.result.skipped_already_exists} skipped (already exist)</div>
            )}
            {step.result.skipped_no_v2_property !== undefined && step.result.skipped_no_v2_property > 0 && (
              <div className="text-warning">↳ {step.result.skipped_no_v2_property} skipped (no matching V2 property)</div>
            )}
            {step.result.skipped_missing_refs_or_exists !== undefined && step.result.skipped_missing_refs_or_exists > 0 && (
              <div className="text-warning">↳ {step.result.skipped_missing_refs_or_exists} skipped (missing references or already exist)</div>
            )}
            {step.result.skipped !== undefined && step.result.skipped > 0 && (
              <div className="text-muted-foreground">↳ {step.result.skipped} skipped</div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function MigrationDashboard() {
  const { data: steps, isLoading } = useMigrationStatus();
  const runStep = useRunMigrationStep();
  const runFull = useRunFullMigration();
  const [stepResults, setStepResults] = useState<Record<string, MigrationResult>>({});
  const [runningStep, setRunningStep] = useState<string | null>(null);

  const totalV1 = steps?.reduce((s, st) => s + st.v1Count, 0) ?? 0;
  const totalV2 = steps?.reduce((s, st) => s + st.v2Count, 0) ?? 0;
  const overallProgress = totalV1 > 0 ? Math.min(100, Math.round((totalV2 / totalV1) * 100)) : 0;
  const allComplete = steps?.every(s => s.status === 'complete' || s.status === 'skipped') ?? false;

  const handleRunStep = async (step: MigrationStep) => {
    setRunningStep(step.key);
    try {
      const result = await runStep.mutateAsync(step.functionName as any);
      setStepResults(prev => ({ ...prev, [step.key]: result }));
      toast.success(`${step.title}: ${result.migrated} records migrated`);
    } catch (e) {
      console.error('Failed to run migration step:', e);
      toast.error(`Migration failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setRunningStep(null);
    }
  };

  const handleRunFull = async () => {
    try {
      const result = await runFull.mutateAsync();
      const results = result.migration_results;
      const totalMigrated = results.reduce((s: number, r: MigrationResult) => s + r.migrated, 0);
      results.forEach((r: MigrationResult) => {
        const key = steps?.find(s => s.title.includes(r.table.split(' → ')[0]))?.key;
        if (key) setStepResults(prev => ({ ...prev, [key]: r }));
      });
      toast.success(`Migration complete: ${totalMigrated} total records migrated`);
    } catch (e) {
      console.error('Failed to run full migration:', e);
      toast.error(`Full migration failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">V1 → V2 Migration</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Migrate your data to the new system and fill in any gaps
          </p>
        </div>

        {/* Overall Progress Hero */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-3xl font-bold">{overallProgress}%</div>
                <div className="text-sm text-muted-foreground">Overall Migration Progress</div>
              </div>
              <div className="text-right text-sm text-muted-foreground">
                <div>{totalV2} of {totalV1} records migrated</div>
                {allComplete && <Badge variant="default" className="mt-1">All Complete ✓</Badge>}
              </div>
            </div>
            <Progress value={overallProgress} className="h-2" />
          </CardContent>
        </Card>

        <Tabs defaultValue="migration" className="space-y-4">
          <TabsList>
            <TabsTrigger value="migration">Migration</TabsTrigger>
            <TabsTrigger value="gaps">Gap Fill</TabsTrigger>
          </TabsList>

          <TabsContent value="migration" className="space-y-4">
            {/* Master migration button */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="lg" className="w-full" disabled={runFull.isPending || allComplete}>
                  {runFull.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                  {allComplete ? 'Migration Complete' : 'Run Full Migration'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Run Full Migration?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will migrate all V1 data to V2 tables in order: Companies → Properties → Rooms → Tenants → Tenancies → Compliance → Loans → Financials → Contractors. V1 data will not be deleted.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleRunFull}>Continue</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* Step cards */}
            {isLoading ? (
              <div className="space-y-3">
                {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-28" />)}
              </div>
            ) : (
              <div className="space-y-3">
                {steps?.map(step => (
                  <MigrationCard
                    key={step.key}
                    step={{ ...step, result: stepResults[step.key] }}
                    onMigrate={() => handleRunStep(step)}
                    isMigrating={runningStep === step.key}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="gaps">
            <GapFillSection />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
