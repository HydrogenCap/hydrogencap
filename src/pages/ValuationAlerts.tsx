import { useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Bell, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import {
  useValuationAlerts,
  useDismissValuationAlert,
} from '@/hooks/useValuationAlerts';

type Filter = 'active' | 'all';

function fmtGBP(v: number | null) {
  if (v == null) return '—';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
  }).format(v);
}

const ALERT_CONFIG: Record<
  string,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
  }
> = {
  value_increase: {
    label: 'Value Up',
    icon: TrendingUp,
    color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  },
  value_decrease: {
    label: 'Value Down',
    icon: TrendingDown,
    color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
  refinance_opportunity: {
    label: 'Refi Opportunity',
    icon: TrendingUp,
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
};

export default function ValuationAlerts() {
  const [filter, setFilter] = useState<Filter>('active');
  const { data: alerts = [], isLoading } = useValuationAlerts(filter === 'all');
  const dismiss = useDismissValuationAlert();

  const displayed =
    filter === 'active' ? alerts.filter((a) => !a.is_dismissed) : alerts;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">Valuation Alerts</h1>
            <p className="text-muted-foreground">
              Property value changes and refinancing triggers
            </p>
          </div>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={filter === 'active' ? 'default' : 'outline'}
              onClick={() => setFilter('active')}
            >
              Active
            </Button>
            <Button
              size="sm"
              variant={filter === 'all' ? 'default' : 'outline'}
              onClick={() => setFilter('all')}
            >
              All
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        ) : displayed.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Bell className="h-10 w-10 text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-1">No valuation alerts</h3>
              <p className="text-muted-foreground text-sm">
                Your portfolio is stable — no value changes to report.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {displayed.map((alert) => {
              const config = ALERT_CONFIG[alert.alert_type] ?? {
                label: alert.alert_type,
                icon: AlertTriangle,
                color: 'bg-muted text-muted-foreground',
              };
              const Icon = config.icon;
              return (
                <Card key={alert.id} className={alert.is_dismissed ? 'opacity-60' : ''}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-full shrink-0 ${config.color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <Link
                            to={`/properties-v2/${alert.property_id}`}
                            className="font-semibold hover:underline"
                          >
                            {alert.property_address}
                          </Link>
                          <Badge className={config.color}>{config.label}</Badge>
                        </div>
                        <p className="text-sm font-medium">{alert.title}</p>
                        <p className="text-sm text-muted-foreground">{alert.message}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                          {alert.recorded_value_gbp != null && (
                            <span>Was: {fmtGBP(alert.recorded_value_gbp)}</span>
                          )}
                          {alert.estimated_value_gbp != null && (
                            <span>Now: {fmtGBP(alert.estimated_value_gbp)}</span>
                          )}
                          {alert.change_percent !== null && (
                            <span
                              className={
                                alert.change_percent >= 0
                                  ? 'text-emerald-600'
                                  : 'text-red-600'
                              }
                            >
                              {alert.change_percent >= 0 ? '+' : ''}
                              {alert.change_percent.toFixed(1)}%
                            </span>
                          )}
                          <span>
                            {format(new Date(alert.created_at), 'dd/MM/yyyy')}
                          </span>
                        </div>
                      </div>
                      {!alert.is_dismissed && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="shrink-0 text-muted-foreground"
                          disabled={dismiss.isPending}
                          onClick={() => dismiss.mutate(alert.id)}
                        >
                          Dismiss
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
