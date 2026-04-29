import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TEXT, CARD } from '@/lib/design-tokens';
import { Sparkles } from 'lucide-react';
import type { AcquisitionAnalysis } from '@/hooks/useAcquisitionAnalysis';
import { RecommendationBadge, ScoreDisplay } from './RecommendationBadge';
import {
  FinancialCard, PortfolioFitCard, AreaAnalysisCard,
  StrengthsWeaknesses, RiskFactors,
} from './AnalysisCards';

export function AnalysisResults({ analysis }: { analysis: AcquisitionAnalysis }) {
  return (
    <div className="space-y-4">
      {/* Header with recommendation and score */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className={TEXT.pageTitle}>{analysis.address}</h3>
              {analysis.postcode && (
                <p className={`${TEXT.label} mt-1`}>{analysis.postcode}</p>
              )}
            </div>
            <div className="flex items-center gap-4">
              {analysis.overall_score != null && <ScoreDisplay score={analysis.overall_score} />}
              {analysis.recommendation && <RecommendationBadge recommendation={analysis.recommendation} />}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Financial projections */}
      {analysis.financial_analysis && <FinancialCard financial={analysis.financial_analysis} />}

      {/* Portfolio fit and area analysis side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {analysis.portfolio_fit_analysis && <PortfolioFitCard fit={analysis.portfolio_fit_analysis} />}
        {analysis.area_analysis && <AreaAnalysisCard area={analysis.area_analysis} />}
      </div>

      {/* Strengths & Weaknesses */}
      <StrengthsWeaknesses
        strengths={analysis.strengths || []}
        weaknesses={analysis.weaknesses || []}
      />

      {/* Risk factors */}
      <RiskFactors risks={analysis.risk_factors} />

      {/* AI Summary */}
      {analysis.ai_summary && (
        <Card>
          <CardHeader className={CARD.compact}>
            <CardTitle className={`${TEXT.sectionHeading} flex items-center gap-2`}>
              <Sparkles className="h-5 w-5 text-muted-foreground" />
              AI Summary
            </CardTitle>
          </CardHeader>
          <CardContent className={CARD.compact}>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              {analysis.ai_summary.split('\n').map((para, i) => (
                <p key={i} className={TEXT.body}>{para}</p>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
