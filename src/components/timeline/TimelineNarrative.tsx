import { useState } from 'react';
import { Sparkles, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { usePortfolioAI } from '@/hooks/usePortfolioAI';

interface TimelineNarrativeProps {
  narrativeData: string;
  isDataReady: boolean;
}

export function TimelineNarrative({ narrativeData, isDataReady }: TimelineNarrativeProps) {
  const [isOpen, setIsOpen] = useState(true);
  const { insights, isLoading, generateInsights, reset } = usePortfolioAI();

  const handleGenerate = () => {
    if (narrativeData) {
      generateInsights(`
You are analyzing a property portfolio timeline. Generate a compelling narrative summary that tells the story of how this portfolio has evolved.

Focus on:
1. Growth journey - acquisitions, milestones crossed
2. Key decisions - refinancing, strategic moves
3. Current position - equity, cashflow, performance
4. Looking ahead - what the trajectory suggests

Be concise but insightful. Write in first person plural ("we" or "the portfolio").

Here is the portfolio data:

${narrativeData}

Generate a 3-4 paragraph narrative summary.
      `);
    }
  };

  return (
    <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Portfolio Story</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {!insights && !isLoading && isDataReady && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerate}
                  className="text-xs"
                >
                  <Sparkles className="h-3 w-3 mr-1" />
                  Generate
                </Button>
              )}
              {insights && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    reset();
                    handleGenerate();
                  }}
                  className="text-xs"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Refresh
                </Button>
              )}
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={isOpen ? 'Collapse portfolio narrative' : 'Expand portfolio narrative'} aria-expanded={isOpen}>
                  {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-4/6" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : insights?.overview ? (
              <div className="prose prose-sm max-w-none text-foreground">
                <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {insights.overview}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Click "Generate" to create an AI-powered narrative summary of your portfolio journey.
                This will analyze your acquisition history, financial milestones, and performance highlights.
              </p>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
