import { FolderOpen, Clock, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { CategorySummary } from '@/hooks/useDocumentVault';

// ─── Constants ───────────────────────────────────────────────────

const CATEGORY_COLOR_MAP: Record<string, string> = {
  purple: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  blue: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  green: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  amber: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  slate: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  gray: 'bg-muted text-muted-foreground border-border',
};

// ─── Types ───────────────────────────────────────────────────────

export interface GroupedSummary {
  label: string;
  categories: CategorySummary[];
}

interface DocumentCategoryOverviewProps {
  groupedSummaries: GroupedSummary[];
  selectedCategory: string | undefined;
  onCategoryClick: (slug: string) => void;
}

// ─── Component ───────────────────────────────────────────────────

export function DocumentCategoryOverview({
  groupedSummaries,
  selectedCategory,
  onCategoryClick,
}: DocumentCategoryOverviewProps) {
  return (
    <div className="space-y-5">
      {groupedSummaries.map(group => (
        <div key={group.label}>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">
            {group.label}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {group.categories.map(cat => {
              const colorClass = CATEGORY_COLOR_MAP[cat.color || 'gray'] || CATEGORY_COLOR_MAP.gray;
              const isSelected = selectedCategory === cat.slug;

              return (
                <Card
                  key={cat.slug}
                  className={cn(
                    'cursor-pointer transition-all hover:shadow-md border-2',
                    isSelected ? 'border-primary shadow-md' : 'border-transparent hover:border-border',
                  )}
                  onClick={() => onCategoryClick(cat.slug)}
                >
                  <CardContent className="p-3.5">
                    <div className="flex items-start justify-between mb-2">
                      <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center text-sm border', colorClass)}>
                        <FolderOpen className="h-4 w-4" />
                      </div>
                      {cat.count > 0 && (
                        <span className="text-lg font-bold">{cat.count}</span>
                      )}
                    </div>
                    <p className="text-sm font-medium leading-tight">{cat.name}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      {cat.recentCount > 0 && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <Clock className="h-2.5 w-2.5" />
                          {cat.recentCount} new
                        </span>
                      )}
                      {cat.expiringCount > 0 && (
                        <span className="text-[10px] text-amber-500 flex items-center gap-0.5">
                          <AlertTriangle className="h-2.5 w-2.5" />
                          {cat.expiringCount} expiring
                        </span>
                      )}
                      {cat.count === 0 && (
                        <span className="text-[10px] text-muted-foreground">No documents</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
