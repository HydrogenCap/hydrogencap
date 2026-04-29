import { Badge } from '@/components/ui/badge';
import { TEXT } from '@/lib/design-tokens';
import { SEVERITY } from '@/lib/design-tokens';
import { ChevronRight } from 'lucide-react';
import type { AcquisitionAnalysis } from '@/hooks/useAcquisitionAnalysis';
import { RECOMMENDATION_CONFIG } from '../utils/config';

export function PastAnalysisRow({
  analysis,
  onSelect,
}: {
  analysis: AcquisitionAnalysis;
  onSelect: () => void;
}) {
  const config = analysis.recommendation
    ? RECOMMENDATION_CONFIG[analysis.recommendation]
    : null;
  const sev = config ? SEVERITY[config.severity] : SEVERITY.neutral;

  return (
    <button
      onClick={onSelect}
      className="w-full text-left p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors flex items-center gap-4"
    >
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{analysis.address}</div>
        <div className={`${TEXT.label} flex items-center gap-2 mt-1`}>
          {analysis.asking_price && <span>£{analysis.asking_price.toLocaleString()}</span>}
          {analysis.beds != null && <span>{analysis.beds} bed</span>}
          <span>{new Date(analysis.created_at).toLocaleDateString()}</span>
        </div>
      </div>
      {config && (
        <Badge className={sev.badge}>{config.label}</Badge>
      )}
      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
    </button>
  );
}
