import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SEVERITY, TEXT, CARD } from '@/lib/design-tokens';
import {
  useAcquisitionAnalyses,
  useRunAcquisitionAnalysis,
  type AcquisitionInput,
  type AcquisitionAnalysis,
} from '@/hooks/useAcquisitionAnalysis';
import {
  Building2,
  TrendingUp,
  Shield,
  AlertTriangle,
  ChevronRight,
  Loader2,
  Sparkles,
  MapPin,
  PoundSterling,
  Target,
  BarChart3,
  Clock,
} from 'lucide-react';

const PROPERTY_TYPES = [
  { value: 'terraced', label: 'Terraced' },
  { value: 'semi_detached', label: 'Semi-Detached' },
  { value: 'detached', label: 'Detached' },
  { value: 'flat', label: 'Flat / Apartment' },
  { value: 'bungalow', label: 'Bungalow' },
  { value: 'hmo', label: 'HMO' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'mixed_use', label: 'Mixed Use' },
];

const RECOMMENDATION_CONFIG = {
  strong_buy: { label: 'Strong Buy', severity: 'success' as const, icon: TrendingUp },
  buy: { label: 'Buy', severity: 'info' as const, icon: TrendingUp },
  hold: { label: 'Hold', severity: 'warning' as const, icon: Shield },
  avoid: { label: 'Avoid', severity: 'critical' as const, icon: AlertTriangle },
};

function RecommendationBadge({ recommendation }: { recommendation: string }) {
  const config = RECOMMENDATION_CONFIG[recommendation as keyof typeof RECOMMENDATION_CONFIG];
  if (!config) return null;
  const severity = SEVERITY[config.severity];
  const Icon = config.icon;

  return (
    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg ${severity.bg} ${severity.border} border`}>
      <Icon className={`h-5 w-5 ${severity.text}`} />
      <span className={`text-lg font-semibold ${severity.text}`}>{config.label}</span>
    </div>
  );
}

function ScoreDisplay({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const severity = pct >= 75 ? 'success' : pct >= 50 ? 'info' : pct >= 25 ? 'warning' : 'critical';
  const colors = SEVERITY[severity];

  return (
    <div className="flex items-center gap-3">
      <div className={`text-3xl font-bold ${colors.text}`}>{pct}</div>
      <div className="text-sm text-muted-foreground">/100<br />score</div>
    </div>
  );
}

function FinancialCard({ financial }: { financial: AcquisitionAnalysis['financial_analysis'] }) {
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

function PortfolioFitCard({ fit }: { fit: AcquisitionAnalysis['portfolio_fit_analysis'] }) {
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

function AreaAnalysisCard({ area }: { area: AcquisitionAnalysis['area_analysis'] }) {
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

function StrengthsWeaknesses({ strengths, weaknesses }: { strengths: string[]; weaknesses: string[] }) {
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

function RiskFactors({ risks }: { risks: AcquisitionAnalysis['risk_factors'] }) {
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

function AnalysisResults({ analysis }: { analysis: AcquisitionAnalysis }) {
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

function PastAnalysisRow({
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

export default function AcquisitionAdvisor() {
  const [form, setForm] = useState<AcquisitionInput>({ address: '' });
  const [selectedAnalysis, setSelectedAnalysis] = useState<AcquisitionAnalysis | null>(null);
  const { data: pastAnalyses, isLoading: loadingPast } = useAcquisitionAnalyses();
  const runAnalysis = useRunAcquisitionAnalysis();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.address.trim()) return;

    runAnalysis.mutate(form, {
      onSuccess: (data) => {
        const result = data.analysis || data;
        setSelectedAnalysis(result as AcquisitionAnalysis);
        setForm({ address: '' });
      },
    });
  };

  const updateForm = (field: keyof AcquisitionInput, value: string | number | undefined) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Page header */}
        <div>
          <h1 className={TEXT.pageTitle}>Acquisition Advisor</h1>
          <p className={`${TEXT.body} text-muted-foreground mt-1`}>
            AI-powered analysis of potential property purchases against your existing portfolio
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Input form */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className={`${TEXT.sectionHeading} flex items-center gap-2`}>
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  Analyse Property
                </CardTitle>
                <CardDescription>Enter details of the property you're considering</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="address">Address *</Label>
                    <Input
                      id="address"
                      placeholder="123 High Street, London"
                      value={form.address}
                      onChange={(e) => updateForm('address', e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="postcode">Postcode</Label>
                    <Input
                      id="postcode"
                      placeholder="SW1A 1AA"
                      value={form.postcode || ''}
                      onChange={(e) => updateForm('postcode', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="asking_price">Asking Price</Label>
                    <div className="relative">
                      <PoundSterling className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="asking_price"
                        type="number"
                        className="pl-9"
                        placeholder="250000"
                        value={form.asking_price ?? ''}
                        onChange={(e) =>
                          updateForm('asking_price', e.target.value ? Number(e.target.value) : undefined)
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="estimated_rental">Est. Monthly Rent</Label>
                    <div className="relative">
                      <PoundSterling className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="estimated_rental"
                        type="number"
                        className="pl-9"
                        placeholder="1200"
                        value={form.estimated_rental ?? ''}
                        onChange={(e) =>
                          updateForm('estimated_rental', e.target.value ? Number(e.target.value) : undefined)
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="property_type">Property Type</Label>
                    <Select
                      value={form.property_type || ''}
                      onValueChange={(v) => updateForm('property_type', v)}
                    >
                      <SelectTrigger id="property_type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {PROPERTY_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="beds">Bedrooms</Label>
                    <Input
                      id="beds"
                      type="number"
                      min={0}
                      max={20}
                      placeholder="3"
                      value={form.beds ?? ''}
                      onChange={(e) =>
                        updateForm('beds', e.target.value ? Number(e.target.value) : undefined)
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      placeholder="Any additional context..."
                      rows={3}
                      value={form.notes || ''}
                      onChange={(e) => updateForm('notes', e.target.value)}
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={!form.address.trim() || runAnalysis.isPending}
                  >
                    {runAnalysis.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Analysing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Analyse
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Past analyses */}
            <Card className="mt-4">
              <CardHeader className={CARD.compact}>
                <CardTitle className={`${TEXT.sectionHeading} flex items-center gap-2`}>
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  Past Analyses
                </CardTitle>
              </CardHeader>
              <CardContent className={CARD.compact}>
                {loadingPast ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : pastAnalyses && pastAnalyses.length > 0 ? (
                  <div className="space-y-2">
                    {pastAnalyses.map((a) => (
                      <PastAnalysisRow
                        key={a.id}
                        analysis={a}
                        onSelect={() => setSelectedAnalysis(a)}
                      />
                    ))}
                  </div>
                ) : (
                  <p className={`${TEXT.label} text-center py-6`}>
                    No analyses yet. Submit a property above to get started.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Results panel */}
          <div className="lg:col-span-2">
            {runAnalysis.isPending ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                  <p className={TEXT.sectionHeading}>Analysing acquisition...</p>
                  <p className={`${TEXT.label} mt-2`}>
                    Comparing against your portfolio, calculating metrics, and assessing risks
                  </p>
                </CardContent>
              </Card>
            ) : selectedAnalysis ? (
              <AnalysisResults analysis={selectedAnalysis} />
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <BarChart3 className="h-12 w-12 text-muted-foreground/30 mb-4" />
                  <p className={TEXT.sectionHeading}>No analysis selected</p>
                  <p className={`${TEXT.label} mt-2 max-w-md`}>
                    Enter property details on the left and click "Analyse" to get AI-powered
                    acquisition recommendations based on your portfolio.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
