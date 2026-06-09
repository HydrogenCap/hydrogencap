import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, TrendingUp } from 'lucide-react';
import {
  useRefinancingOpportunities,
  useUpdateRefinancingOpportunity,
} from '@/hooks/useRefinancingOpportunities';
import { LenderPackDialog } from '@/components/refinancing/LenderPackDialog';

function fmtGBP(v: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v);
}

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  reviewed: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  actioned: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  dismissed: 'bg-muted text-muted-foreground',
};

export default function RefinancingOpportunities() {
  const { data: opportunities = [], isLoading } = useRefinancingOpportunities();
  const update = useUpdateRefinancingOpportunity();

  const active = opportunities.filter(
    (o) => o.status !== 'dismissed' && o.status !== 'completed',
  );
  const archived = opportunities.filter(
    (o) => o.status === 'dismissed' || o.status === 'completed',
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Refinancing Opportunities</h1>
          <p className="text-muted-foreground">
            AI-identified opportunities to release equity or improve terms
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
        ) : active.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <TrendingUp className="h-10 w-10 text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-1">No active opportunities</h3>
              <p className="text-muted-foreground text-sm">
                Run the AI analysis from the Lending page to generate refinancing
                suggestions.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {active.map((o) => (
              <Card key={o.id} className="border-l-4 border-l-primary">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      to={`/properties-v2/${o.property_id}`}
                      className="font-semibold hover:underline"
                    >
                      {o.property_address}
                    </Link>
                    <Badge className={STATUS_COLORS[o.status] ?? STATUS_COLORS.new}>
                      {o.status.charAt(0).toUpperCase() + o.status.slice(1)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Current Mortgage</p>
                      <p className="font-semibold">{fmtGBP(o.current_mortgage_gbp)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Current LTV</p>
                      <p className="font-semibold">{o.current_ltv.toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Target LTV</p>
                      <p className="font-semibold">{o.target_ltv.toFixed(1)}%</p>
                    </div>
                  </div>
                  <div className="rounded-md bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2">
                    <p className="text-xs text-muted-foreground">Potential Equity Release</p>
                    <p className="text-lg font-bold text-emerald-700">
                      {fmtGBP(o.potential_release_gbp)}
                    </p>
                  </div>
                  {o.notes && (
                    <p className="text-sm text-muted-foreground">{o.notes}</p>
                  )}
                  <div className="flex gap-2 pt-1">
                    {o.status === 'new' && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={update.isPending}
                        onClick={() => update.mutate({ id: o.id, status: 'reviewed' })}
                      >
                        Mark Reviewed
                      </Button>
                    )}
                    {(o.status === 'new' || o.status === 'reviewed') && (
                      <Button
                        size="sm"
                        disabled={update.isPending}
                        onClick={() => update.mutate({ id: o.id, status: 'completed' })}
                      >
                        Mark Actioned
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground"
                      disabled={update.isPending}
                      onClick={() => update.mutate({ id: o.id, status: 'dismissed' })}
                    >
                      Dismiss
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {archived.length > 0 && (
          <div>
            <h2 className="text-sm font-medium text-muted-foreground mb-3">
              Archived ({archived.length})
            </h2>
            <div className="space-y-2">
              {archived.map((o) => (
                <div
                  key={o.id}
                  className="flex items-center justify-between px-4 py-2 rounded-lg border text-sm"
                >
                  <span className="text-muted-foreground">{o.property_address}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-medium">
                      {fmtGBP(o.potential_release_gbp)} potential
                    </span>
                    <Badge className={STATUS_COLORS[o.status] ?? ''}>{o.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
