import { Link } from 'react-router-dom';
import { ClipboardList, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatGBP } from '@/lib/calculations';
import { useWorkOrderCounts } from '@/hooks/useWorkOrders';

export function WorkOrdersWidget() {
  const { data: counts, isLoading } = useWorkOrderCounts();

  if (isLoading || !counts || counts.total === 0) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <ClipboardList className="h-4 w-4" />
          Works Orders
        </CardTitle>
        <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
          <Link to="/work-orders">View All <ArrowRight className="h-3 w-3 ml-1" /></Link>
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold">{counts.awaitingApproval}</p>
            <p className="text-xs text-muted-foreground">Awaiting Approval</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{counts.inProgress}</p>
            <p className="text-xs text-muted-foreground">In Progress</p>
          </div>
          {counts.urgent > 0 ? (
            <div>
              <p className="text-2xl font-bold text-destructive">{counts.urgent}</p>
              <p className="text-xs text-muted-foreground">Urgent</p>
            </div>
          ) : (
            <div>
              <p className="text-2xl font-bold">{formatGBP(counts.totalActual)}</p>
              <p className="text-xs text-muted-foreground">Actual Spend</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
