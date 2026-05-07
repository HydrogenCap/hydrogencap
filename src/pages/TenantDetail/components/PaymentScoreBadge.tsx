import { Badge } from '@/components/ui/badge';
import { useTenantPaymentScore } from '@/hooks/useTenantLifecycle';
import { getPaymentScoreRating } from '@/lib/tenant-scoring';
import { SCORE_SEVERITY_BG } from '../utils/badges';

export function PaymentScoreBadge({ tenantId }: { tenantId: string }) {
  const { data } = useTenantPaymentScore(tenantId);
  if (!data || data.score === 0) return null;
  const { rating, severity } = getPaymentScoreRating(data.score);
  return <Badge className={SCORE_SEVERITY_BG[severity]}>{data.score}% {rating}</Badge>;
}
