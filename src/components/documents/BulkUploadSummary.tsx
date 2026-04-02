import { CheckCircle2, AlertTriangle, FileText, Eye, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SEVERITY } from '@/lib/design-tokens';
import type { BulkUploadStats } from '@/hooks/useBulkDocumentUpload';

interface BulkUploadSummaryProps {
  stats: BulkUploadStats;
  onSendToReview: () => void;
  onDone: () => void;
}

function StatCard({
  label,
  value,
  icon: Icon,
  severity,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  severity: keyof typeof SEVERITY;
}) {
  return (
    <div className={`flex items-center gap-3 rounded-lg border p-4 ${SEVERITY[severity].bg} ${SEVERITY[severity].border}`}>
      <div className={`flex h-10 w-10 items-center justify-center rounded-full ${SEVERITY[severity].bg}`}>
        <Icon className={`h-5 w-5 ${SEVERITY[severity].text}`} />
      </div>
      <div>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function DocTypeGroup({ docType, count }: { docType: string; count: number }) {
  const label = docType === 'unclassified'
    ? 'Unclassified'
    : docType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-2">
        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-sm">{label}</span>
      </div>
      <Badge variant="secondary" className="tabular-nums">{count}</Badge>
    </div>
  );
}

export function BulkUploadSummary({ stats, onSendToReview, onDone }: BulkUploadSummaryProps) {
  const sortedTypes = Object.entries(stats.byDocType).sort(([, a], [, b]) => b - a);

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Classified"
          value={stats.classified}
          icon={CheckCircle2}
          severity="success"
        />
        <StatCard
          label="Extracted"
          value={stats.extracted}
          icon={FileText}
          severity="info"
        />
        <StatCard
          label="Needs Review"
          value={stats.needsReview}
          icon={Eye}
          severity="warning"
        />
        <StatCard
          label="Failed"
          value={stats.failed}
          icon={AlertTriangle}
          severity={stats.failed > 0 ? 'critical' : 'neutral'}
        />
      </div>

      {/* Doc Type Breakdown */}
      {sortedTypes.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Documents by Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {sortedTypes.map(([docType, count]) => (
                <DocTypeGroup key={docType} docType={docType} count={count} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        {stats.needsReview > 0 && (
          <Button variant="outline" onClick={onSendToReview} className="gap-2">
            <Eye className="h-4 w-4" />
            Send to Review Queue
            <Badge variant="secondary" className="ml-1">{stats.needsReview}</Badge>
          </Button>
        )}
        <Button onClick={onDone} className="gap-2">
          Done
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
