import { Button } from '@/components/ui/button';
import { AlertTriangle, TrendingUp, Construction, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type QuickFilterType = 'all' | 'needs_attention' | 'high_performers' | 'development';

interface QuickFiltersProps {
  activeFilter: QuickFilterType;
  onFilterChange: (filter: QuickFilterType) => void;
  counts: {
    all: number;
    needsAttention: number;
    highPerformers: number;
    development: number;
  };
}

export function QuickFilters({ activeFilter, onFilterChange, counts }: QuickFiltersProps) {
  const filters: { key: QuickFilterType; label: string; icon: React.ElementType; count: number }[] = [
    { key: 'all', label: 'All Properties', icon: Building2, count: counts.all },
    { key: 'needs_attention', label: 'Needs Attention', icon: AlertTriangle, count: counts.needsAttention },
    { key: 'high_performers', label: 'High Performers', icon: TrendingUp, count: counts.highPerformers },
    { key: 'development', label: 'Development', icon: Construction, count: counts.development },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {filters.map((filter) => {
        const Icon = filter.icon;
        const isActive = activeFilter === filter.key;
        
        return (
          <Button
            key={filter.key}
            variant={isActive ? 'default' : 'outline'}
            size="sm"
            onClick={() => onFilterChange(filter.key)}
            className={cn(
              'gap-2',
              isActive && 'shadow-md'
            )}
          >
            <Icon className="h-4 w-4" />
            {filter.label}
            <span className={cn(
              'ml-1 rounded-full px-2 py-0.5 text-xs',
              isActive ? 'bg-primary-foreground/20' : 'bg-muted'
            )}>
              {filter.count}
            </span>
          </Button>
        );
      })}
    </div>
  );
}
