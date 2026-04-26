import { useNavigate } from 'react-router-dom';
import { ChevronRight, Gavel } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useRRBReadinessPortfolio } from '@/hooks/useRRBReadiness';

const RING_SIZE = 72;
const RING_STROKE = 7;

function ProgressRing({ percent }: { percent: number }) {
  const radius = (RING_SIZE - RING_STROKE) / 2;
  const c = 2 * Math.PI * radius;
  const dash = (Math.min(100, Math.max(0, percent)) / 100) * c;
  const stroke =
    percent >= 80
      ? 'hsl(var(--success))'
      : percent >= 60
        ? 'hsl(var(--warning))'
        : 'hsl(var(--destructive))';
  return (
    <div
      className="relative shrink-0"
      style={{ width: RING_SIZE, height: RING_SIZE }}
      role="img"
      aria-label={`${percent}% RRB readiness`}
    >
      <svg width={RING_SIZE} height={RING_SIZE} className="-rotate-90">
        <circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth={RING_STROKE} />
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth={RING_STROKE}
          strokeDasharray={`${dash} ${c}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-base font-semibold text-foreground">{percent}%</span>
      </div>
    </div>
  );
}

export function RentersRightsBillKPI() {
  const navigate = useNavigate();
  const { data, isLoading } = useRRBReadinessPortfolio();

  const percent = data?.averageScore ?? 0;
  const below = data?.propertiesBelow80 ?? 0;
  const subtitle = isLoading
    ? 'Calculating…'
    : below === 0
      ? 'All properties on track'
      : `${below} ${below === 1 ? 'property' : 'properties'} below 80%`;

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => navigate('/renters-rights')}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          navigate('/renters-rights');
        }
      }}
      className="cursor-pointer hover:bg-accent/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      data-testid="rrb-kpi"
    >
      <CardContent className="p-4 flex items-center gap-4">
        <ProgressRing percent={percent} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
            <Gavel className="h-3 w-3" /> RRB Readiness
          </div>
          <div className="text-sm font-semibold text-foreground mt-0.5 truncate">
            Renters' Rights Bill
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </CardContent>
    </Card>
  );
}

export default RentersRightsBillKPI;
