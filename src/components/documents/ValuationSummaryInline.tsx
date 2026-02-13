import { useState } from 'react';
import {
  Sparkles, Loader2, ChevronDown, ChevronUp,
  User, Calendar, Star, AlertTriangle, Wrench, BarChart3, Ruler,
} from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  useDocumentSummary,
  useTriggerDocumentSummary,
  type ValuationSummary,
} from '@/hooks/useDocumentSummary';
import { cn } from '@/lib/utils';

const fmt = (n: number) => `£${n.toLocaleString()}`;

const CONDITION_COLORS: Record<string, string> = {
  Good: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  Fair: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  Poor: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  'Very Poor': 'bg-red-200 text-red-800 dark:bg-red-900/50 dark:text-red-300',
};

interface Props {
  documentId: string;
  compact?: boolean;
}

export function ValuationSummaryInline({ documentId, compact = false }: Props) {
  const { data: summary, isLoading } = useDocumentSummary(documentId);
  const trigger = useTriggerDocumentSummary();
  const [expanded, setExpanded] = useState(!compact);

  if (!isLoading && !summary) {
    return (
      <div className={compact ? 'px-3.5 pb-3' : 'mt-3'}>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 w-full justify-center"
          onClick={(e) => { e.stopPropagation(); trigger.mutate(documentId); }}
          disabled={trigger.isPending}
        >
          {trigger.isPending ? (
            <><Loader2 className="h-4 w-4 animate-spin" />Analysing…</>
          ) : (
            <><Sparkles className="h-4 w-4 text-purple-500" />Generate AI Summary</>
          )}
        </Button>
      </div>
    );
  }

  if (isLoading) return null;
  if (summary?.status === 'processing') {
    return (
      <div className={cn('flex items-center gap-2 text-sm text-muted-foreground', compact ? 'px-3.5 pb-3' : 'mt-3')}>
        <Loader2 className="h-4 w-4 animate-spin" />
        Analysing valuation document…
      </div>
    );
  }
  if (summary?.status === 'failed') {
    return (
      <div className={cn('flex items-center justify-between text-sm', compact ? 'px-3.5 pb-3' : 'mt-3')}>
        <span className="text-muted-foreground">Analysis failed</span>
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); trigger.mutate(documentId); }}>Retry</Button>
      </div>
    );
  }
  if (!summary || summary.status !== 'completed') return null;

  if (compact) {
    return (
      <div className="px-3.5 pb-3" onClick={(e) => e.stopPropagation()}>
        <button onClick={() => setExpanded(prev => !prev)} className="w-full flex items-center gap-2 text-left">
          <Sparkles className="h-3.5 w-3.5 text-purple-500 shrink-0" />
          <span className="text-xs text-muted-foreground flex-1 truncate">
            {summary.executive_summary || 'AI summary available'}
          </span>
          {summary.valuation_figure_gbp && (
            <span className="text-xs font-bold text-foreground shrink-0">{fmt(summary.valuation_figure_gbp)}</span>
          )}
          {expanded ? <ChevronUp className="h-3 w-3 shrink-0" /> : <ChevronDown className="h-3 w-3 shrink-0" />}
        </button>
        {expanded && <SummaryDetails summary={summary} />}
      </div>
    );
  }

  return (
    <Card className="border-purple-200 dark:border-purple-800 bg-purple-50/30 dark:bg-purple-950/10">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-500" />
            <span className="text-sm font-semibold">AI Valuation Summary</span>
          </div>
          <Button
            variant="ghost" size="sm" className="h-7 text-xs"
            onClick={() => trigger.mutate(documentId)}
            disabled={trigger.isPending}
          >
            {trigger.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Refresh'}
          </Button>
        </div>

        {summary.executive_summary && (
          <p className="text-sm text-foreground leading-relaxed">{summary.executive_summary}</p>
        )}

        <div className="grid grid-cols-2 gap-3">
          {summary.valuation_figure_gbp && (
            <MetricBox icon={BarChart3} label="Valuation" value={fmt(summary.valuation_figure_gbp)} />
          )}
          {summary.valuation_date && (
            <MetricBox icon={Calendar} label="Date" value={format(new Date(summary.valuation_date), 'dd MMM yyyy')} />
          )}
          {summary.condition_rating && (
            <MetricBox icon={Star} label="Condition" value={summary.condition_rating} badgeClass={CONDITION_COLORS[summary.condition_rating]} />
          )}
          {summary.tenure && (
            <MetricBox icon={User} label="Tenure" value={summary.tenure} />
          )}
        </div>

        <SummaryDetails summary={summary} />
      </CardContent>
    </Card>
  );
}

function SummaryDetails({ summary }: { summary: ValuationSummary }) {
  return (
    <div className="space-y-3 mt-3">
      {(summary.surveyor_name || summary.surveyor_firm) && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <User className="h-3 w-3" />
          {summary.surveyor_name}{summary.surveyor_firm && ` — ${summary.surveyor_firm}`}
          {summary.surveyor_rics_number && ` (RICS ${summary.surveyor_rics_number})`}
        </div>
      )}
      {summary.gross_internal_area_sqft && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Ruler className="h-3 w-3" />
          {summary.gross_internal_area_sqft.toLocaleString()} sq ft
          {summary.price_per_sqft && ` · £${summary.price_per_sqft.toLocaleString()}/sq ft`}
        </div>
      )}
      {summary.key_observations?.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Key Observations</p>
          <ul className="space-y-0.5">
            {summary.key_observations.map((obs, i) => (
              <li key={i} className="text-xs text-foreground flex items-start gap-1.5">
                <span className="text-muted-foreground mt-0.5">•</span>{obs}
              </li>
            ))}
          </ul>
        </div>
      )}
      {summary.risk_factors?.length > 0 && (
        <div>
          <p className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-1 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />Risk Factors
          </p>
          <ul className="space-y-0.5">
            {summary.risk_factors.map((r, i) => (
              <li key={i} className="text-xs text-foreground flex items-start gap-1.5">
                <span className="text-amber-500 mt-0.5">•</span>{r}
              </li>
            ))}
          </ul>
        </div>
      )}
      {summary.recommended_actions?.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
            <Wrench className="h-3 w-3" />Recommended Actions
          </p>
          <ul className="space-y-0.5">
            {summary.recommended_actions.map((a, i) => (
              <li key={i} className="text-xs text-foreground flex items-start gap-1.5">
                <span className="text-muted-foreground mt-0.5">•</span>{a}
              </li>
            ))}
          </ul>
        </div>
      )}
      {summary.comparable_evidence?.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Comparable Evidence Cited</p>
          <div className="space-y-1">
            {summary.comparable_evidence.map((c, i) => (
              <div key={i} className="text-xs flex items-center justify-between">
                <span className="truncate flex-1 mr-2">{c.address}</span>
                <span className="font-medium shrink-0">£{c.price?.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricBox({ icon: Icon, label, value, badgeClass }: {
  icon: React.ComponentType<{ className?: string }>; label: string; value: string; badgeClass?: string;
}) {
  return (
    <div className="rounded-lg border bg-background p-2.5 text-center">
      <Icon className="h-3.5 w-3.5 mx-auto mb-1 text-muted-foreground" />
      {badgeClass ? (
        <Badge className={cn('text-[10px] px-1.5', badgeClass)}>{value}</Badge>
      ) : (
        <div className="text-sm font-bold">{value}</div>
      )}
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}
