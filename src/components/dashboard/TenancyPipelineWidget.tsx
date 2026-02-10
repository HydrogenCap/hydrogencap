import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, ArrowRight, AlertTriangle } from 'lucide-react';
import { differenceInDays, format } from 'date-fns';
import { useTenancies } from '@/hooks/useTenancies';

export function TenancyPipelineWidget() {
  const { data: tenancies } = useTenancies();

  const stats = useMemo(() => {
    if (!tenancies) return null;

    const active = tenancies.filter(t => t.status === 'active');
    const onNotice = tenancies.filter(t => t.status === 'notice');

    const endingSoon = active.filter(t => {
      if (!t.end_date) return false;
      const days = differenceInDays(new Date(t.end_date), new Date());
      return days >= 0 && days <= 60;
    }).sort((a, b) => new Date(a.end_date!).getTime() - new Date(b.end_date!).getTime());

    const periodic = active.filter(t => !t.end_date);

    return {
      activeCount: active.length,
      noticeCount: onNotice.length,
      periodicCount: periodic.length,
      endingSoon,
    };
  }, [tenancies]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4" />
          Tenancies
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!stats ? (
          <p className="text-sm text-muted-foreground text-center py-4">No tenancy data</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-2xl font-bold text-primary">{stats.activeCount}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
              <div>
                <p className={`text-2xl font-bold ${stats.noticeCount > 0 ? 'text-warning' : 'text-muted-foreground'}`}>
                  {stats.noticeCount}
                </p>
                <p className="text-xs text-muted-foreground">On Notice</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-muted-foreground">{stats.periodicCount}</p>
                <p className="text-xs text-muted-foreground">Periodic</p>
              </div>
            </div>

            {stats.endingSoon.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 text-warning" />
                  Ending within 60 days
                </p>
                {stats.endingSoon.slice(0, 3).map(t => (
                  <div key={t.id} className="flex items-center justify-between text-sm p-2 rounded-md bg-warning/5 border border-warning/20">
                    <span className="truncate font-medium">
                      {t.property.address_line}
                    </span>
                    <Badge variant="outline" className="text-xs shrink-0 ml-2">
                      {format(new Date(t.end_date!), 'dd MMM')}
                    </Badge>
                  </div>
                ))}
                {stats.endingSoon.length > 3 && (
                  <p className="text-xs text-muted-foreground text-center">
                    +{stats.endingSoon.length - 3} more
                  </p>
                )}
              </div>
            )}
          </>
        )}

        <Link to="/tenants" className="flex items-center gap-1 text-sm text-primary hover:underline">
          View all tenants
          <ArrowRight className="h-3 w-3" />
        </Link>
      </CardContent>
    </Card>
  );
}
