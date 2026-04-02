import { Card, CardContent } from '@/components/ui/card';

interface MetricCardProps {
  icon: React.ElementType;
  title: string;
  value: string;
  subtitle: string;
  status?: 'positive' | 'negative' | 'neutral';
}

export function MetricCard({ icon: Icon, title, value, subtitle, status = 'neutral' }: MetricCardProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-sm text-muted-foreground mb-1">{title}</div>
            <div className={`text-2xl font-bold ${
              status === 'positive' ? 'text-success' :
              status === 'negative' ? 'text-destructive' : ''
            }`}>
              {value}
            </div>
            <div className="text-xs text-muted-foreground mt-1">{subtitle}</div>
          </div>
          <div className="p-2 rounded-lg bg-muted">
            <Icon className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
