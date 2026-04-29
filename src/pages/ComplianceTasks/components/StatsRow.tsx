import { Card, CardContent } from '@/components/ui/card';

interface Stats {
  openCount: number;
  overdueCount: number;
  criticalCount: number;
  completedThisMonth: number;
}

export function StatsRow({ stats }: { stats: Stats }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card>
        <CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{stats.openCount}</p>
          <p className="text-xs text-muted-foreground">Open Tasks</p>
        </CardContent>
      </Card>
      <Card className={stats.overdueCount > 0 ? 'border-destructive' : ''}>
        <CardContent className="p-4 text-center">
          <p className={`text-2xl font-bold ${stats.overdueCount > 0 ? 'text-destructive' : ''}`}>{stats.overdueCount}</p>
          <p className="text-xs text-muted-foreground">Overdue</p>
        </CardContent>
      </Card>
      <Card className={stats.criticalCount > 0 ? 'border-destructive bg-destructive/5' : ''}>
        <CardContent className="p-4 text-center">
          <p className={`text-2xl font-bold ${stats.criticalCount > 0 ? 'text-destructive' : ''}`}>{stats.criticalCount}</p>
          <p className="text-xs text-muted-foreground">Critical</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-primary">{stats.completedThisMonth}</p>
          <p className="text-xs text-muted-foreground">Completed This Month</p>
        </CardContent>
      </Card>
    </div>
  );
}
