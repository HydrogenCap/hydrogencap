import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { AlertTriangle, Clock, Calendar, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useRevaluationTriggers } from '@/hooks/useValuationEvidence';

function fmtGBP(v: number | null) {
  if (v == null) return '—';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0 }).format(v);
}

const SEVERITY_STYLES: Record<string, string> = {
  high: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  low: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
};

interface RevaluationTriggerProps {
  propertyId?: string;
}

export function RevaluationTrigger({ propertyId }: RevaluationTriggerProps) {
  const { data: triggers, isLoading } = useRevaluationTriggers();

  const displayed = propertyId
    ? (triggers ?? []).filter((t) => t.property_id === propertyId)
    : (triggers ?? []);

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle>Revaluation Triggers</CardTitle></CardHeader>
        <CardContent><div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}</div></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Revaluation Triggers
            </CardTitle>
            <CardDescription>
              {displayed.length} propert{displayed.length !== 1 ? 'ies' : 'y'} flagged for revaluation
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <Calendar className="h-10 w-10 text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-1">All valuations are current</h3>
            <p className="text-muted-foreground text-sm">No properties require revaluation at this time.</p>
          </div>
        ) : (
          <div className="divide-y">
            {displayed.map((trigger) => (
              <div key={trigger.property_id} className="p-4 hover:bg-muted/30 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Link
                        to={`/properties-v2/${trigger.property_id}`}
                        className="font-semibold text-sm hover:underline"
                      >
                        {trigger.address}
                      </Link>
                      {trigger.postcode && (
                        <span className="text-xs text-muted-foreground">{trigger.postcode}</span>
                      )}
                      <Badge className={`text-xs ${SEVERITY_STYLES[trigger.severity]}`}>
                        {trigger.severity}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{trigger.reason}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                      {trigger.current_valuation != null && (
                        <span>Current: {fmtGBP(trigger.current_valuation)}</span>
                      )}
                      {trigger.last_valuation_date && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(trigger.last_valuation_date), { addSuffix: true })}
                        </span>
                      )}
                    </div>
                  </div>
                  <Link to={`/properties-v2/${trigger.property_id}`}>
                    <Button variant="ghost" size="sm" className="shrink-0">
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
