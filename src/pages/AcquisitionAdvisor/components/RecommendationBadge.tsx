import { SEVERITY } from '@/lib/design-tokens';
import { RECOMMENDATION_CONFIG } from '../utils/config';

export function RecommendationBadge({ recommendation }: { recommendation: string }) {
  const config = RECOMMENDATION_CONFIG[recommendation as keyof typeof RECOMMENDATION_CONFIG];
  if (!config) return null;
  const severity = SEVERITY[config.severity];
  const Icon = config.icon;

  return (
    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg ${severity.bg} ${severity.border} border`}>
      <Icon className={`h-5 w-5 ${severity.text}`} />
      <span className={`text-lg font-semibold ${severity.text}`}>{config.label}</span>
    </div>
  );
}

export function ScoreDisplay({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const severity = pct >= 75 ? 'success' : pct >= 50 ? 'info' : pct >= 25 ? 'warning' : 'critical';
  const colors = SEVERITY[severity];

  return (
    <div className="flex items-center gap-3">
      <div className={`text-3xl font-bold ${colors.text}`}>{pct}</div>
      <div className="text-sm text-muted-foreground">/100<br />score</div>
    </div>
  );
}
