import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { 
  HealthScoreBreakdown, 
  getHealthGrade, 
  getHealthStatus 
} from '@/lib/calculations';

interface HealthScoreBadgeProps {
  score: HealthScoreBreakdown;
  showTooltip?: boolean;
  size?: 'sm' | 'md';
}

export function HealthScoreBadge({ score, showTooltip = true, size = 'sm' }: HealthScoreBadgeProps) {
  const grade = getHealthGrade(score.total);
  const status = getHealthStatus(grade);
  
  const badgeClasses = {
    success: 'bg-success/15 text-success border-success/30 hover:bg-success/20',
    warning: 'bg-warning/15 text-warning border-warning/30 hover:bg-warning/20',
    danger: 'bg-destructive/15 text-destructive border-destructive/30 hover:bg-destructive/20',
  };

  const sizeClasses = {
    sm: 'h-6 px-2 text-xs font-semibold',
    md: 'h-8 px-3 text-sm font-bold',
  };

  const badge = (
    <Badge 
      variant="outline" 
      className={`${badgeClasses[status]} ${sizeClasses[size]} cursor-default`}
    >
      {grade} ({score.total})
    </Badge>
  );

  if (!showTooltip) return badge;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent side="top" className="w-48 p-3">
          <div className="space-y-2">
            <div className="font-medium text-center mb-2">
              Health Score: {score.total}/100
            </div>
            <div className="space-y-1.5 text-xs">
              <ScoreRow label="Cashflow" value={score.cashflow} max={25} />
              <ScoreRow label="Leverage" value={score.leverage} max={25} />
              <ScoreRow label="Risk" value={score.risk} max={25} />
              <ScoreRow label="Compliance" value={score.compliance} max={25} />
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function ScoreRow({ label, value, max }: { label: string; value: number; max: number }) {
  const percent = (value / max) * 100;
  
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 text-muted-foreground">{label}</span>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full ${
            percent >= 70 ? 'bg-success' : percent >= 40 ? 'bg-warning' : 'bg-destructive'
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="w-8 text-right">{value}/{max}</span>
    </div>
  );
}
