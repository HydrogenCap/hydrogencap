import { Card, CardContent } from '@/components/ui/card';

export function KpiCard({
  icon: Icon,
  label,
  value,
  accent,
  destructive,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent?: boolean;
  destructive?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
        <p
          className={`text-xl font-bold ${
            destructive ? 'text-destructive' : accent ? 'text-primary' : ''
          }`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

export function SA105Box({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-muted-foreground text-xs">{label}</span>
      <p className="font-semibold text-sm">{value}</p>
    </div>
  );
}
