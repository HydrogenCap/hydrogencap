import {
  Sparkles,
  RefreshCw,
  Loader2,
  Target,
  TriangleAlert,
  Lightbulb,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { type AIInsights } from '@/hooks/usePortfolioAI';

// ============================================================
// AIInsightsDisplay (internal sub-component)
// ============================================================

interface AIInsightsDisplayProps {
  insights: AIInsights;
  onFilterClick: (filterType: string) => void;
}

function AIInsightsDisplay({ insights, onFilterClick }: AIInsightsDisplayProps) {
  return (
    <div className="space-y-6">
      {/* Overview */}
      <div className="p-4 rounded-lg bg-primary/5 border border-primary/10">
        <p className="text-sm leading-relaxed">{insights.overview}</p>
      </div>

      {/* Grid layout for priorities, risks, opportunities */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Priorities */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Target className="h-4 w-4 text-primary" />
            <h4 className="font-medium">Top Priorities</h4>
          </div>
          <ul className="space-y-2">
            {insights.priorities?.slice(0, 5).map((item, i) => (
              <li key={i} className="text-sm">
                <span className="font-medium">{item.text}</span>
                {item.reason && (
                  <span className="text-muted-foreground"> — {item.reason}</span>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* Risks */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <TriangleAlert className="h-4 w-4 text-destructive" />
            <h4 className="font-medium">Risks</h4>
          </div>
          <ul className="space-y-2">
            {insights.risks?.map((item, i) => (
              <li key={i} className="text-sm">
                {item.filterType ? (
                  <button
                    onClick={() => onFilterClick(item.filterType!)}
                    className="text-left hover:underline text-primary"
                  >
                    {item.text}
                  </button>
                ) : (
                  <span>{item.text}</span>
                )}
                {item.reason && (
                  <span className="text-muted-foreground"> — {item.reason}</span>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* Opportunities */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="h-4 w-4 text-success" />
            <h4 className="font-medium">Opportunities</h4>
          </div>
          <ul className="space-y-2">
            {insights.opportunities?.map((item, i) => (
              <li key={i} className="text-sm">
                {item.filterType ? (
                  <button
                    onClick={() => onFilterClick(item.filterType!)}
                    className="text-left hover:underline text-primary"
                  >
                    {item.text}
                  </button>
                ) : (
                  <span>{item.text}</span>
                )}
                {item.reason && (
                  <span className="text-muted-foreground"> — {item.reason}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// AIPortfolioCard (exported)
// ============================================================

interface AIPortfolioCardProps {
  aiInsights: AIInsights | null;
  aiLoading: boolean;
  onRefresh: () => void;
  navigate: (path: string) => void;
}

export function AIPortfolioCard({ aiInsights, aiLoading, onRefresh, navigate }: AIPortfolioCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">AI Portfolio Analysis</CardTitle>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={aiLoading}
          >
            {aiLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-1">Refresh</span>
          </Button>
        </div>
        <CardDescription>
          Generated from your portfolio data only — no external assumptions
        </CardDescription>
      </CardHeader>
      <CardContent>
        {aiLoading && !aiInsights ? (
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : aiInsights ? (
          <AIInsightsDisplay insights={aiInsights} onFilterClick={(filter) => navigate(`/properties?filter=${filter}`)} />
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>AI insights will appear here</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
