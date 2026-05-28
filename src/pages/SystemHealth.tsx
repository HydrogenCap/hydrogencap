import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseAny } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageSkeleton, EmptyState } from '@/components/common';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Activity, AlertCircle, FileX, CheckCircle2, RefreshCw, RotateCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

interface ErrorRow {
  id: string;
  source: string;
  severity: string;
  message: string;
  context: any;
  resolved: boolean;
  created_at: string;
}

interface DocRow {
  id: string;
  status: string | null;
  file_name: string | null;
  created_at: string;
  validation_errors: string[] | null;
}

export default function SystemHealth() {
  usePageTitle('System Health');
  const queryClient = useQueryClient();
  const since = useMemo(() => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), []);

  const errorsQ = useQuery({
    queryKey: ['errors_log_recent'],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('errors_log')
        .select('id, source, severity, message, context, resolved, created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as ErrorRow[];
    },
    staleTime: 30_000,
  });

  const docsQ = useQuery({
    queryKey: ['documents_pipeline_recent'],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('documents')
        .select('id, status, file_name, created_at, validation_errors')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as DocRow[];
    },
    staleTime: 30_000,
  });

  const docStats = useMemo(() => {
    const docs = docsQ.data || [];
    const total = docs.length;
    let processed = 0;
    let failed = 0;
    let stuck = 0;
    const stuckCutoff = Date.now() - 10 * 60 * 1000; // 10 minutes
    for (const d of docs) {
      const status = (d.status || '').toLowerCase();
      if (status === 'processed' || status === 'classified' || status === 'completed') processed++;
      else if (status === 'failed' || status === 'error') failed++;
      else if (status === 'processing' || status === 'queued' || status === 'pending') {
        if (new Date(d.created_at).getTime() < stuckCutoff) stuck++;
      }
    }
    const successRate = total > 0 ? Math.round((processed / total) * 100) : null;
    return { total, processed, failed, stuck, successRate };
  }, [docsQ.data]);

  const resolveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabaseAny
        .from('errors_log')
        .update({ resolved: true })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Marked resolved');
      queryClient.invalidateQueries({ queryKey: ['errors_log_recent'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to update'),
  });

  if (errorsQ.isLoading || docsQ.isLoading) {
    return <AppLayout><PageSkeleton /></AppLayout>;
  }

  const errors = errorsQ.data || [];
  const unresolved = errors.filter((e) => !e.resolved);

  return (
    <AppLayout>
      <div className="space-y-6 max-w-6xl mx-auto p-4 md:p-6">
        <header className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Activity className="h-6 w-6" />
              System Health
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Last 7 days · error log, document pipeline, stuck jobs.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              errorsQ.refetch();
              docsQ.refetch();
            }}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </header>

        <div className="grid gap-3 md:grid-cols-4">
          <StatCard
            icon={AlertCircle}
            label="Open errors"
            value={unresolved.length}
            tone={unresolved.length > 0 ? 'destructive' : 'good'}
          />
          <StatCard
            icon={FileX}
            label="Stuck docs"
            value={docStats.stuck}
            tone={docStats.stuck > 0 ? 'warning' : 'good'}
          />
          <StatCard
            icon={FileX}
            label="Failed docs"
            value={docStats.failed}
            tone={docStats.failed > 0 ? 'warning' : 'good'}
          />
          <StatCard
            icon={CheckCircle2}
            label="Doc success rate"
            value={docStats.successRate !== null ? `${docStats.successRate}%` : '—'}
            tone={docStats.successRate !== null && docStats.successRate >= 90 ? 'good' : 'warning'}
          />
        </div>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent errors</CardTitle>
            <Badge variant="outline">{errors.length} total</Badge>
          </CardHeader>
          <CardContent className="p-0">
            {errors.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="No errors logged"
                description="Nothing in the last 7 days. System is healthy."
              />
            ) : (
              <div className="divide-y divide-border">
                {errors.map((e) => (
                  <div key={e.id} className="p-3 flex items-start gap-3 hover:bg-muted/40">
                    <AlertCircle
                      className={`h-4 w-4 shrink-0 mt-0.5 ${
                        e.severity === 'error' || e.severity === 'critical'
                          ? 'text-destructive'
                          : 'text-amber-500'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{e.message}</div>
                      <div className="text-xs text-muted-foreground">
                        {e.source} · {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
                      </div>
                      {e.context && Object.keys(e.context).length > 0 && (
                        <details className="text-xs text-muted-foreground mt-1">
                          <summary className="cursor-pointer hover:text-foreground">Context</summary>
                          <pre className="mt-1 p-2 bg-muted rounded overflow-x-auto text-[11px]">
                            {JSON.stringify(e.context, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                    {e.resolved ? (
                      <Badge variant="secondary" className="shrink-0">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Resolved
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => resolveMutation.mutate(e.id)}
                        disabled={resolveMutation.isPending}
                      >
                        Mark resolved
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Document pipeline (7d)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-3 text-sm">
              <PipelineStat label="Uploaded" value={docStats.total} />
              <PipelineStat label="Processed" value={docStats.processed} tone="good" />
              <PipelineStat label="Failed" value={docStats.failed} tone={docStats.failed > 0 ? 'destructive' : 'muted'} />
              <PipelineStat label="Stuck >10m" value={docStats.stuck} tone={docStats.stuck > 0 ? 'warning' : 'muted'} />
            </div>
            {docStats.stuck > 0 && (
              <div className="mt-4 p-3 rounded border border-amber-500/40 bg-amber-500/5 text-sm flex items-start gap-2">
                <RotateCw className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <div className="font-medium">{docStats.stuck} document(s) stuck in processing</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    These have sat in queued/processing for over 10 minutes. Try re-uploading them from the Bulk
                    Upload page.
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  tone: 'good' | 'warning' | 'destructive';
}) {
  const color =
    tone === 'destructive'
      ? 'text-destructive'
      : tone === 'warning'
      ? 'text-amber-600'
      : 'text-green-600';
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide">
          <Icon className={`h-4 w-4 ${color}`} />
          {label}
        </div>
        <div className={`text-2xl font-bold mt-1 ${color}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function PipelineStat({
  label,
  value,
  tone = 'muted',
}: {
  label: string;
  value: number;
  tone?: 'good' | 'warning' | 'destructive' | 'muted';
}) {
  const color =
    tone === 'destructive'
      ? 'text-destructive'
      : tone === 'warning'
      ? 'text-amber-600'
      : tone === 'good'
      ? 'text-green-600'
      : 'text-foreground';
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-xl font-bold ${color}`}>{value}</div>
    </div>
  );
}
