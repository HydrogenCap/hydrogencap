import { useState } from 'react';
import { AlertTriangle, RefreshCw, ChevronDown, ChevronUp, ShieldAlert, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SEVERITY, type SeverityLevel } from '@/lib/design-tokens';
import {
  useArrearsPredictions,
  useRunArrearsPrediction,
  useArrearsRiskSummary,
  type ArrearsPrediction,
} from '@/hooks/useArrearsPredictions';
import { formatDistanceToNow } from 'date-fns';

const RISK_SEVERITY: Record<string, SeverityLevel> = {
  critical: 'critical',
  high: 'warning',
  medium: 'info',
  low: 'success',
};

function RiskBadge({ level }: { level: string }) {
  const severity = RISK_SEVERITY[level] ?? 'neutral';
  const classes = SEVERITY[severity];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${classes.badge}`}>
      {level.charAt(0).toUpperCase() + level.slice(1)}
    </span>
  );
}

function RiskScoreBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  let colour = 'bg-green-500';
  if (score > 0.75) colour = 'bg-red-500';
  else if (score > 0.5) colour = 'bg-amber-500';
  else if (score > 0.25) colour = 'bg-blue-500';

  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${colour}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted-foreground tabular-nums w-8 text-right">{pct}%</span>
    </div>
  );
}

function PredictionRow({ prediction }: { prediction: ArrearsPrediction }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border rounded-lg">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">
            Tenant ID: {prediction.tenant_id?.slice(0, 8) ?? 'Unknown'}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            Property: {prediction.property_id.slice(0, 8)}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <RiskScoreBar score={prediction.risk_score} />
          <RiskBadge level={prediction.risk_level} />
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t">
          {/* Contributing Factors */}
          {prediction.contributing_factors.length > 0 && (
            <div className="pt-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">Contributing Factors</p>
              <div className="flex flex-wrap gap-1.5">
                {prediction.contributing_factors.map((f, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {f.factor}
                    {f.weight >= 4 && (
                      <TrendingDown className="h-3 w-3 ml-1 text-destructive" />
                    )}
                    {f.weight <= 2 && (
                      <Minus className="h-3 w-3 ml-1 text-muted-foreground" />
                    )}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Recommended Actions */}
          {prediction.recommended_actions.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Recommended Actions</p>
              <ul className="space-y-1">
                {prediction.recommended_actions.map((action, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <TrendingUp className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
                    <span>{action}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface ArrearsRiskPanelProps {
  propertyId?: string;
}

export function ArrearsRiskPanel({ propertyId }: ArrearsRiskPanelProps) {
  const { data: predictions, isLoading } = useArrearsPredictions(propertyId);
  const { data: summary } = useArrearsRiskSummary();
  const runPrediction = useRunArrearsPrediction();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const hasPredictions = predictions && predictions.length > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" />
            Arrears Risk Assessment
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => runPrediction.mutate(propertyId)}
            disabled={runPrediction.isPending}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${runPrediction.isPending ? 'animate-spin' : ''}`} />
            {runPrediction.isPending ? 'Analysing...' : 'Run Prediction'}
          </Button>
        </div>
        {summary?.lastRunAt && (
          <p className="text-xs text-muted-foreground">
            Last run {formatDistanceToNow(new Date(summary.lastRunAt), { addSuffix: true })}
          </p>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Risk Summary Bar */}
        {hasPredictions && summary && summary.total > 0 && (
          <div className="grid grid-cols-4 gap-3">
            <div className={`p-3 rounded-lg text-center ${SEVERITY.critical.bg}`}>
              <p className={`text-xl font-bold ${SEVERITY.critical.text}`}>{summary.critical}</p>
              <p className="text-xs text-muted-foreground">Critical</p>
            </div>
            <div className={`p-3 rounded-lg text-center ${SEVERITY.warning.bg}`}>
              <p className={`text-xl font-bold ${SEVERITY.warning.text}`}>{summary.high}</p>
              <p className="text-xs text-muted-foreground">High</p>
            </div>
            <div className={`p-3 rounded-lg text-center ${SEVERITY.info.bg}`}>
              <p className={`text-xl font-bold ${SEVERITY.info.text}`}>{summary.medium}</p>
              <p className="text-xs text-muted-foreground">Medium</p>
            </div>
            <div className={`p-3 rounded-lg text-center ${SEVERITY.success.bg}`}>
              <p className={`text-xl font-bold ${SEVERITY.success.text}`}>{summary.low}</p>
              <p className="text-xs text-muted-foreground">Low</p>
            </div>
          </div>
        )}

        {/* Prediction List */}
        {hasPredictions ? (
          <div className="space-y-2">
            {predictions.map((prediction) => (
              <PredictionRow key={prediction.id} prediction={prediction} />
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <AlertTriangle className="h-8 w-8 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              No predictions yet. Click "Run Prediction" to analyse your tenants' payment patterns.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
