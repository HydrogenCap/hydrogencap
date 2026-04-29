import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SEVERITY, TEXT, CARD } from '@/lib/design-tokens';
import { PoundSterling, Target, MapPin, TrendingUp, AlertTriangle, Shield } from 'lucide-react';
import type { AcquisitionAnalysis } from '@/hooks/useAcquisitionAnalysis';

export function FinancialCard({ financial }: { financial: AcquisitionAnalysis['financial_analysis'] }) {
  const items = [
    { label: 'Gross Yield', value: financial.gross_yield != null ? `${financial.gross_yield.toFixed(1)}%` : null },
    { label: 'Net Yield', value: financial.net_yield != null ? `${financial.net_yield.toFixed(1)}%` : null },
    { label: 'Monthly Cashflow', value: financial.monthly_cashflow != null ? `£${financial.monthly_cashflow.toLocaleString()}` : null },
    { label: 'Annual ROI', value: financial.annual_roi != null ? `${financial.annual_roi.toFixed(1)}%` : null },
    { label: 'Price / Bed', value: financial.price_per_bed != null ? `£${Math.round(financial.price_per_bed).toLocaleString()}` : null },
    { label: 'SDLT Estimate', value: financial.sdlt_estimate != null ? `£${Math.round(financial.sdlt_estimate).toLocaleString()}` : null },
    { label: 'Total Cost', value: financial.total_acquisition_cost != null ? `£${Math.round(financial.total_acquisition_cost).toLocaleString()}` : null },
  ].filter(i => i.value != null);

  if (items.length === 0) return null;

  return (
    <Card>
      <CardHeader className={CARD.compact}>
        <CardTitle className={`${TEXT.sectionHeading} flex items-center gap-2`}>
          <PoundSterling className="h-5 w-5 text-muted-foreground" />
          Financial Projections
        </CardTitle>
      </CardHeader>
      <CardContent className={CARD.compact}>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map(({ label, value }) => (
            <div key={label}>
              <div className={TEXT.label}>{label}</div>
              <div className="text-lg font-semibold">{value}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function PortfolioFitCard({ fit }: { fit: AcquisitionAnalysis['portfolio_fit_analysis'] }) {
  const riskSeverity = (level?: string) => {
    if (level === 'low' || level === 'positive') return 'success';
    if (level === 'medium' || level === 'neutral') return 'warning';
    return 'critical';
  };

  const items = [
    { label: 'Diversification Impact', value: fit.diversification_impact },
    { label: 'Geographic Concentration', value: fit.geographic_concentration_risk },
    { label: 'Type Concentration', value: fit.type_concentration_risk },
  ].filter(i => i.value);

  return (
    <Card>
      <CardHeader className={CARD.compact}>
        <CardTitle className={`${TEXT.sectionHeading} flex items-center gap-2`}>
          <Target className="h-5 w-5 text-muted-foreground" />
          Portfolio Fit
        </CardTitle>
      </CardHeader>
      <CardContent className={CARD.compact}>
        <div className="space-y-3">
          {items.map(({ label, value }) => {
            const sev = SEVERITY[riskSeverity(value) as keyof typeof SEVERITY];
            return (
              <div key={label} className="flex items-center justify-between">
                <span className={TEXT.body}>{label}</span>
                <Badge className={sev.badge}>{value}</Badge>
              </div>
            );
          })}
          {fit.lender_diversification_note && (
            <div className="pt-2 border-t">
              <div className={TEXT.label}>Lender Note</div>
              <div className={TEXT.body}>{fit.lender_diversification_note}</div>
            </div>
          )}
          {fit.portfolio_yield_impact && (
            <div className="pt-2 border-t">
              <div className={TEXT.label}>Yield Impact</div>
              <div className={TEXT.body}>{fit.portfolio_yield_impact}</div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function AreaAnalysisCard({ area }: { area: AcquisitionAnalysis['area_analysis'] }) {
  const demandSeverity = (d?: string) => {
    if (d === 'strong') return 'success';
    if (d === 'moderate') return 'warning';
    return 'critical';
  };

  return (
    <Card>
      <CardHeader className={CARD.compact}>
        <CardTitle className={`${TEXT.sectionHeading} flex items-center gap-2`}>
          <MapPin className="h-5 w-5 text-muted-foreground" />
          Area Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className={CARD.compact}>
        <div className="space-y-3">
          {area.rental_demand && (
            <div className="flex items-center justify-between">
              <span className={TEXT.body}>Rental Demand</span>
              <Badge className={SEVERITY[demandSeverity(area.rental_demand)].badge}>
                {area.rental_demand}
              </Badge>
            </div>
          )}
          {area.area_comparison && (
            <div className="pt-2 border-t">
              <div className={TEXT.label}>vs Portfolio Locations</div>
              <div className={TEXT.body}>{area.area_comparison}</div>
            </div>
          )}
          {area.growth_outlook && (
            <div className="pt-2 border-t">
              <div className={TEXT.label}>Growth Outlook</div>
              <div className={TEXT.body}>{area.growth_outlook}</div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function StrengthsWeaknesses({ strengths, weaknesses }: { strengths: string[]; weaknesses: string[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardHeader className={CARD.compact}>
          <CardTitle className={`${TEXT.sectionHeading} flex items-center gap-2 ${SEVERITY.success.text}`}>
            <TrendingUp className="h-5 w-5" />
            Strengths
          </CardTitle>
        </CardHeader>
        <CardContent className={CARD.compact}>
          <ul className="space-y-2">
            {strengths.map((s, i) => (
              <li key={i} className={`flex items-start gap-2 ${TEXT.body}`}>
                <div className={`mt-1.5 h-2 w-2 rounded-full flex-shrink-0 ${SEVERITY.success.dot}`} />
                {s}
              </li>
            ))}
            {strengths.length === 0 && (
              <li className={TEXT.label}>No strengths identified</li>
            )}
          </ul>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className={CARD.compact}>
          <CardTitle className={`${TEXT.sectionHeading} flex items-center gap-2 ${SEVERITY.warning.text}`}>
            <AlertTriangle className="h-5 w-5" />
            Weaknesses
          </CardTitle>
        </CardHeader>
        <CardContent className={CARD.compact}>
          <ul className="space-y-2">
            {weaknesses.map((w, i) => (
              <li key={i} className={`flex items-start gap-2 ${TEXT.body}`}>
                <div className={`mt-1.5 h-2 w-2 rounded-full flex-shrink-0 ${SEVERITY.warning.dot}`} />
                {w}
              </li>
            ))}
            {weaknesses.length === 0 && (
              <li className={TEXT.label}>No weaknesses identified</li>
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

export function RiskFactors({ risks }: { risks: AcquisitionAnalysis['risk_factors'] }) {
  if (!risks || risks.length === 0) return null;

  const severityMap: Record<string, keyof typeof SEVERITY> = {
    high: 'critical',
    medium: 'warning',
    low: 'info',
  };

  return (
    <Card>
      <CardHeader className={CARD.compact}>
        <CardTitle className={`${TEXT.sectionHeading} flex items-center gap-2`}>
          <Shield className="h-5 w-5 text-muted-foreground" />
          Risk Factors
        </CardTitle>
      </CardHeader>
      <CardContent className={CARD.compact}>
        <div className="space-y-3">
          {risks.map((risk, i) => {
            const sev = SEVERITY[severityMap[risk.severity] || 'neutral'];
            return (
              <div key={i} className={`p-3 rounded-lg border ${sev.bg} ${sev.border}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm">{risk.factor}</span>
                  <Badge className={sev.badge}>{risk.severity}</Badge>
                </div>
                <p className={TEXT.label}>{risk.detail}</p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
