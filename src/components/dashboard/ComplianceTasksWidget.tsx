import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ClipboardList, AlertTriangle, Clock, Upload, ArrowRight } from 'lucide-react';
import { useComplianceTaskStats } from '@/hooks/useComplianceTasks';

export function ComplianceTasksWidget() {
  const navigate = useNavigate();
  const stats = useComplianceTaskStats();

  const items = [
    { label: 'Overdue', value: stats.overdueCount, icon: AlertTriangle, color: 'text-destructive' },
    { label: 'Critical', value: stats.criticalCount, icon: Clock, color: 'text-warning' },
    { label: 'Open', value: stats.openCount, icon: ClipboardList, color: 'text-primary' },
    { label: 'Completed (month)', value: stats.completedThisMonth, icon: Upload, color: 'text-success' },
  ];

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary" />
            Compliance Tasks
          </CardTitle>
          {stats.overdueCount > 0 && (
            <Badge variant="destructive" className="text-xs">
              {stats.overdueCount} overdue
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {items.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="flex items-center gap-2">
              <Icon className={`h-4 w-4 ${color}`} />
              <span className={`text-lg font-bold ${color}`}>{value}</span>
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => navigate('/compliance-tasks')}
        >
          View Pipeline
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </CardContent>
    </Card>
  );
}
