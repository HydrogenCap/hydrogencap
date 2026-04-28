import { useState } from 'react';
import { format } from 'date-fns';
import {
  Brain, Zap, Clock, Target, FileCheck, TrendingUp,
  CheckCircle2, AlertTriangle, Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useAIProcessingStats, useProcessingHistory } from '@/hooks/useAIProcessingStats';
import { COMPLIANCE_DOC_TYPE_LABELS } from '@/hooks/useComplianceIntake';
import { RecentProcessingDetailSheet, type ProcessingHistoryDoc } from './RecentProcessingDetailSheet';

function StatCard({ icon: Icon, label, value, subtitle, iconColor }: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subtitle?: string;
  iconColor?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <Icon className={`h-5 w-5 ${iconColor || 'text-muted-foreground'}`} />
        </div>
      </CardContent>
    </Card>
  );
}

function ConfidenceBadge({ value }: { value: number | null }) {
  if (!value) return <Badge variant="outline">—</Badge>;
  const pct = Math.round(value * 100);
  if (pct >= 80) return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">{pct}%</Badge>;
  if (pct >= 50) return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">{pct}%</Badge>;
  return <Badge variant="destructive">{pct}%</Badge>;
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'completed': return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    case 'processing': case 'pending': return <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />;
    case 'failed': return <AlertTriangle className="h-4 w-4 text-destructive" />;
    default: return null;
  }
}

export function AIProcessingDashboard() {
  const { data: stats, isLoading: statsLoading } = useAIProcessingStats();
  const { data: history, isLoading: historyLoading } = useProcessingHistory(30);
  const [selectedDoc, setSelectedDoc] = useState<ProcessingHistoryDoc | null>(null);

  if (statsLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const totalProcessed = stats?.totalProcessed30d ?? 0;
  const hasData = totalProcessed > 0;
  const accuracyDisplay = hasData ? `${Math.round(stats?.classificationAccuracy ?? 0)}%` : 'N/A';
  const autoFileDisplay = hasData ? `${Math.round(stats?.autoFileRate ?? 0)}%` : 'N/A';

  return (
    <div className="space-y-5">
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={Zap}
          label="Processed Today"
          value={stats?.processedToday ?? 0}
          iconColor="text-amber-500"
        />
        <StatCard
          icon={Clock}
          label="Awaiting Review"
          value={stats?.awaitingReview ?? 0}
          iconColor="text-blue-500"
        />
        <StatCard
          icon={FileCheck}
          label="Auto-File Rate"
          value={autoFileDisplay}
          subtitle={hasData ? `${stats?.autoFiled30d ?? 0} of ${totalProcessed} (30d)` : 'No data yet'}
          iconColor="text-emerald-500"
        />
        <StatCard
          icon={Target}
          label="Classification Accuracy"
          value={accuracyDisplay}
          subtitle={hasData ? `Avg ${Math.round((stats?.avgProcessingTime ?? 0) / 1000)}s processing` : 'No data yet'}
          iconColor="text-violet-500"
        />
      </div>

      {/* Accuracy Progress */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Brain className="h-4 w-4" />
            AI Performance (30 days)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!hasData ? (
            <p className="text-sm text-muted-foreground py-2">
              No documents processed in the last 30 days. Upload a certificate to see AI performance metrics.
            </p>
          ) : (
            <>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Classification Accuracy</span>
                  <span>{accuracyDisplay}</span>
                </div>
                <Progress value={stats?.classificationAccuracy ?? 0} className="h-2" />
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Auto-File Rate</span>
                  <span>{autoFileDisplay}</span>
                </div>
                <Progress value={stats?.autoFileRate ?? 0} className="h-2" />
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
                <span className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  {totalProcessed} docs processed
                </span>
                <span>{stats?.totalTokens30d?.toLocaleString() ?? 0} AI tokens used</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Recent Processing History */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Recent Processing</CardTitle>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <Skeleton className="h-48" />
          ) : !history?.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">No documents processed yet</p>
          ) : (
            <div className="overflow-auto max-h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">Status</TableHead>
                    <TableHead>File</TableHead>
                    <TableHead>Classification</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Review</TableHead>
                    <TableHead className="text-right">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell><StatusIcon status={doc.extraction_status || ''} /></TableCell>
                      <TableCell className="max-w-[180px] truncate text-xs font-medium">
                        {doc.original_file_name}
                      </TableCell>
                      <TableCell className="text-xs">
                        {doc.ai_suggested_doc_type
                          ? (COMPLIANCE_DOC_TYPE_LABELS[doc.ai_suggested_doc_type] || doc.ai_suggested_doc_type)
                          : '—'}
                      </TableCell>
                      <TableCell>
                        <ConfidenceBadge value={doc.ai_doc_type_confidence} />
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          doc.review_status === 'accepted' ? 'default' :
                          doc.review_status === 'rejected' ? 'destructive' :
                          doc.auto_filed ? 'secondary' : 'outline'
                        }>
                          {doc.auto_filed ? 'Auto-filed' : doc.review_status || 'pending'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {doc.created_at ? format(new Date(doc.created_at), 'dd MMM HH:mm') : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
