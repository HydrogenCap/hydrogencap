import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Building2, Shield, TrendingUp, ArrowRight } from 'lucide-react';
import { format, startOfMonth, isAfter } from 'date-fns';
import { useProperties } from '@/hooks/useProperties';
import { useAllCompliance } from '@/hooks/useCompliance';
import { formatGBP } from '@/lib/calculations';

export function ThisMonthWidget() {
  const { data: properties } = useProperties();
  const { data: complianceItems } = useAllCompliance();

  const stats = useMemo(() => {
    const monthStart = startOfMonth(new Date());
    
    // Properties acquired this month
    const propertiesThisMonth = properties?.filter(p => {
      if (!p.original_purchase_date) return false;
      return isAfter(new Date(p.original_purchase_date), monthStart);
    }) || [];

    // Properties converted to core rental this month
    const convertedThisMonth = properties?.filter(p => {
      if (!p.operational_date || p.lifecycle_type !== 'core_rental') return false;
      return isAfter(new Date(p.operational_date), monthStart);
    }) || [];

    // Compliance items completed this month
    const complianceCompletedThisMonth = complianceItems?.filter(item => {
      if (!item.issue_date) return false;
      return isAfter(new Date(item.issue_date), monthStart);
    }) || [];

    // Calculate total value added
    const valueAdded = propertiesThisMonth.reduce((sum, p) => {
      return sum + (p.current_value_gbp ? Number(p.current_value_gbp) : 0);
    }, 0);

    return {
      acquired: propertiesThisMonth.length,
      converted: convertedThisMonth.length,
      complianceCompleted: complianceCompletedThisMonth.length,
      valueAdded,
    };
  }, [properties, complianceItems]);

  const currentMonth = format(new Date(), 'MMMM yyyy');

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Calendar className="h-4 w-4" />
          This Month
          <Badge variant="secondary" className="ml-auto font-normal">
            {currentMonth}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" />
              Acquired
            </div>
            <p className="text-2xl font-bold">{stats.acquired}</p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5" />
              Go-Live
            </div>
            <p className="text-2xl font-bold">{stats.converted}</p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Shield className="h-3.5 w-3.5" />
              Compliance Done
            </div>
            <p className="text-2xl font-bold">{stats.complianceCompleted}</p>
          </div>

          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Value Added</div>
            <p className="text-xl font-bold text-primary">
              {stats.valueAdded > 0 ? formatGBP(stats.valueAdded) : '—'}
            </p>
          </div>
        </div>

        <Link 
          to="/timeline" 
          className="flex items-center gap-1 text-sm text-primary hover:underline"
        >
          View portfolio timeline
          <ArrowRight className="h-3 w-3" />
        </Link>
      </CardContent>
    </Card>
  );
}
