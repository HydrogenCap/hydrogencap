import { usePortfolioRisks } from '@/hooks/usePortfolioRisks';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ActionsBadgeProps {
  className?: string;
}

export function ActionsBadge({ className }: ActionsBadgeProps) {
  const { totalCount, criticalCount, isLoading } = usePortfolioRisks();
  
  if (isLoading || totalCount === 0) return null;
  
  return (
    <Badge 
      variant={criticalCount > 0 ? "destructive" : "secondary"}
      className={cn("h-5 min-w-5 px-1.5 text-xs", className)}
    >
      {totalCount}
    </Badge>
  );
}
