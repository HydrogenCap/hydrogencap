import {
  TrendingUp,
  Sparkles,
  RefreshCw,
  Loader2,
  TriangleAlert,
  MapPin,
  Globe,
  Landmark,
  Lightbulb,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { type LocationInsights } from '@/hooks/useLocationAI';

// ============================================================
// LocationInsightsDisplay (internal sub-component)
// ============================================================

interface LocationInsightsDisplayProps {
  insights: LocationInsights;
}

function LocationInsightsDisplay({ insights }: LocationInsightsDisplayProps) {
  return (
    <div className="space-y-6">
      {/* Location Summary */}
      <div className="p-4 rounded-lg bg-primary/5 border border-primary/10">
        <p className="text-sm leading-relaxed">{insights.locationSummary}</p>
      </div>

      {/* Concentration Risk */}
      <div className={`p-4 rounded-lg border ${
        insights.concentrationRisk.level === 'high'
          ? 'bg-destructive/5 border-destructive/20'
          : insights.concentrationRisk.level === 'medium'
          ? 'bg-warning/5 border-warning/20'
          : 'bg-success/5 border-success/20'
      }`}>
        <div className="flex items-center gap-2 mb-2">
          <MapPin className={`h-4 w-4 ${
            insights.concentrationRisk.level === 'high'
              ? 'text-destructive'
              : insights.concentrationRisk.level === 'medium'
              ? 'text-warning'
              : 'text-success'
          }`} />
          <span className="font-medium text-sm">
            Geographic Concentration: <span className="uppercase">{insights.concentrationRisk.level}</span>
          </span>
        </div>
        <p className="text-sm text-muted-foreground">{insights.concentrationRisk.explanation}</p>
      </div>

      {/* Grid layout for insights */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Local Authority Insights */}
        {insights.localAuthorityInsights?.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Landmark className="h-4 w-4 text-primary" />
              <h4 className="font-medium text-sm">Local Authority Insights</h4>
            </div>
            <ul className="space-y-2">
              {insights.localAuthorityInsights.map((item, i) => (
                <li key={i} className="text-sm p-2 rounded bg-muted/50">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{item.authority}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      item.impact === 'positive'
                        ? 'bg-success/10 text-success'
                        : item.impact === 'negative'
                        ? 'bg-destructive/10 text-destructive'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {item.impact}
                    </span>
                  </div>
                  <p className="text-muted-foreground">{item.insight}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Market Context */}
        {insights.marketContext?.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h4 className="font-medium text-sm">Market Trends</h4>
            </div>
            <ul className="space-y-2">
              {insights.marketContext.map((item, i) => (
                <li key={i} className="text-sm p-2 rounded bg-muted/50">
                  <div className="font-medium mb-1">{item.area}</div>
                  <p className="text-muted-foreground mb-1">{item.trend}</p>
                  <p className="text-xs text-primary">💡 {item.recommendation}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Risks and Opportunities */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* External Risks */}
        {insights.externalRisks?.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <TriangleAlert className="h-4 w-4 text-destructive" />
              <h4 className="font-medium text-sm">External Risks</h4>
            </div>
            <ul className="space-y-2">
              {insights.externalRisks.map((item, i) => (
                <li key={i} className="text-sm p-2 rounded bg-destructive/5 border border-destructive/10">
                  <div className="font-medium mb-1">{item.risk}</div>
                  {item.affectedProperties?.length > 0 && (
                    <p className="text-xs text-muted-foreground mb-1">
                      Affects: {item.affectedProperties.slice(0, 3).join(', ')}
                      {item.affectedProperties.length > 3 && ` +${item.affectedProperties.length - 3} more`}
                    </p>
                  )}
                  <p className="text-xs text-primary">Mitigation: {item.mitigation}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Opportunities */}
        {insights.opportunities?.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="h-4 w-4 text-success" />
              <h4 className="font-medium text-sm">Opportunities</h4>
            </div>
            <ul className="space-y-2">
              {insights.opportunities.map((item, i) => (
                <li key={i} className="text-sm p-2 rounded bg-success/5 border border-success/10">
                  <div className="font-medium mb-1">{item.opportunity}</div>
                  <p className="text-muted-foreground">{item.rationale}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// LocationAnalysisCard (exported)
// ============================================================

interface LocationAnalysisCardProps {
  locationInsights: LocationInsights | null;
  locationLoading: boolean;
  onGenerate: () => void;
  onRefresh: () => void;
  hasGenerated: boolean;
}

export function LocationAnalysisCard({
  locationInsights,
  locationLoading,
  onGenerate,
  onRefresh,
  hasGenerated,
}: LocationAnalysisCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">AI Location & Market Analysis</CardTitle>
          </div>
          {locationInsights ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={locationLoading}
            >
              {locationLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="ml-1">Refresh</span>
            </Button>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={onGenerate}
              disabled={locationLoading}
            >
              {locationLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Sparkles className="h-4 w-4 mr-1" />
              )}
              Generate
            </Button>
          )}
        </div>
        <CardDescription>
          External market insights, local authority factors, and geographic risk analysis
        </CardDescription>
      </CardHeader>
      <CardContent>
        {locationLoading && !locationInsights ? (
          <div className="space-y-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : locationInsights ? (
          <LocationInsightsDisplay insights={locationInsights} />
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Globe className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="mb-2">Get AI-powered market insights</p>
            <p className="text-xs">
              Analyzes local authority policies, market trends, concentration risk, and external factors
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
