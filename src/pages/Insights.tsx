import { useMemo, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  AlertCircle,
  Sparkles,
  RefreshCw,
  ChevronRight,
  Percent,
  Building2,
  Wallet,
  PiggyBank,
  Scale,
  Bed,
  Shield,
  ClipboardCheck,
  Loader2,
  Lightbulb,
  Target,
  TriangleAlert,
  MapPin,
  Globe,
  Landmark,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { useProperties } from '@/hooks/useProperties';
import { usePropertyPassports } from '@/hooks/usePropertyPassport';
import { usePortfolioAI, type AIInsights } from '@/hooks/usePortfolioAI';
import { useLocationAI, type LocationInsights } from '@/hooks/useLocationAI';
import {
  calculatePortfolioInsights,
  generateActionItems,
  buildAIPromptData,
  type PortfolioInsights,
  type ActionItem,
} from '@/lib/portfolioInsights';
import { formatGBP, formatPercent } from '@/lib/calculations';

function InsightsPage() {
  const navigate = useNavigate();
  const { data: properties, isLoading: propertiesLoading } = useProperties();
  const { data: passports, isLoading: passportsLoading } = usePropertyPassports();
  const { insights: aiInsights, isLoading: aiLoading, generateInsights } = usePortfolioAI();
  const { 
    insights: locationInsights, 
    isLoading: locationLoading, 
    generateInsights: generateLocationInsights 
  } = useLocationAI();
  const [hasGeneratedAI, setHasGeneratedAI] = useState(false);
  const [hasGeneratedLocation, setHasGeneratedLocation] = useState(false);

  // Calculate deterministic metrics
  const portfolioInsights = useMemo(() => {
    if (!properties || properties.length === 0) return null;
    return calculatePortfolioInsights(properties, passports || []);
  }, [properties, passports]);

  // Generate action items
  const actionItems = useMemo(() => {
    if (!portfolioInsights || !properties) return [];
    return generateActionItems(portfolioInsights, properties);
  }, [portfolioInsights, properties]);

  // Prepare location data for AI
  const locationData = useMemo(() => {
    if (!properties || !passports) return [];
    return properties.map(p => {
      const passport = passports.find(pp => pp.property_id === p.id);
      const income = p.income?.[0];
      return {
        address: p.address_line,
        postcode: p.postcode || passport?.postcode || '',
        postcodeArea: p.postcode_area || '',
        areaName: p.area_name || '',
        localAuthority: passport?.local_authority_text || passport?.local_authority || '',
        latitude: p.latitude ?? undefined,
        longitude: p.longitude ?? undefined,
        epcRating: p.epc_rating || undefined,
        councilTaxBand: passport?.council_tax_band || undefined,
        propertyType: p.property_type || undefined,
        beds: p.beds ?? undefined,
        currentValue: p.current_value_gbp ?? undefined,
        annualRent: income?.annual_rent_gbp ?? undefined,
      };
    });
  }, [properties, passports]);

  // Auto-generate AI insights on first load
  useEffect(() => {
    if (portfolioInsights && properties && !hasGeneratedAI && !aiLoading) {
      const promptData = buildAIPromptData(portfolioInsights, properties);
      generateInsights(promptData);
      setHasGeneratedAI(true);
    }
  }, [portfolioInsights, properties, hasGeneratedAI, aiLoading, generateInsights]);

  const handleRefreshAI = async () => {
    if (!portfolioInsights || !properties) return;
    const promptData = buildAIPromptData(portfolioInsights, properties);
    await generateInsights(promptData);
  };

  const handleGenerateLocationAI = async () => {
    if (!portfolioInsights || !properties || locationData.length === 0) return;
    const summaryData = buildAIPromptData(portfolioInsights, properties);
    await generateLocationInsights(locationData, summaryData);
    setHasGeneratedLocation(true);
  };

  const handleRefreshLocationAI = async () => {
    if (!portfolioInsights || !properties || locationData.length === 0) return;
    const summaryData = buildAIPromptData(portfolioInsights, properties);
    await generateLocationInsights(locationData, summaryData);
  };

  const handleActionClick = (action: ActionItem) => {
    // Navigate to properties with filter
    navigate(`/properties?filter=${action.filterType}`);
  };

  const isLoading = propertiesLoading || passportsLoading;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-48" />
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
          </div>
          <Skeleton className="h-64" />
        </div>
      </AppLayout>
    );
  }

  if (!properties || properties.length === 0) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <TrendingUp className="h-16 w-16 text-muted-foreground/50 mb-4" />
          <h2 className="text-xl font-semibold mb-2">No Properties Yet</h2>
          <p className="text-muted-foreground mb-4">
            Add properties to your portfolio to see insights.
          </p>
          <Button asChild>
            <Link to="/properties/new">Add First Property</Link>
          </Button>
        </div>
      </AppLayout>
    );
  }

  if (!portfolioInsights) return null;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <TrendingUp className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Portfolio Insights</h1>
              <p className="text-sm text-muted-foreground">
                {portfolioInsights.propertyCount} properties analysed
              </p>
            </div>
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            icon={Percent}
            title="Weighted Avg Rate"
            value={formatPercent(portfolioInsights.debt.weightedAverageInterestRate, 2)}
            subtitle={`£${(portfolioInsights.debt.totalMortgageBalance / 1000000).toFixed(1)}M debt`}
          />
          <MetricCard
            icon={Wallet}
            title="Cashflow Margin"
            value={formatPercent(portfolioInsights.cashflow.cashflowMargin, 1)}
            subtitle={`${formatGBP(portfolioInsights.cashflow.totalCashflowAfterDebt)}/yr after debt`}
            status={portfolioInsights.cashflow.totalCashflowAfterDebt >= 0 ? 'positive' : 'negative'}
          />
          <MetricCard
            icon={PiggyBank}
            title="Portfolio Yield"
            value={formatPercent(portfolioInsights.returns.portfolioNetYield, 2)}
            subtitle={`ROCE: ${formatPercent(portfolioInsights.returns.portfolioROCE, 1)}`}
          />
          <MetricCard
            icon={Bed}
            title="Rent / Bedroom"
            value={portfolioInsights.returns.rentPerBedroomMonthly 
              ? `£${portfolioInsights.returns.rentPerBedroomMonthly.toFixed(0)}/mo`
              : '—'
            }
            subtitle={`${portfolioInsights.returns.totalBedrooms} total bedrooms`}
          />
        </div>

        {/* Detailed Metrics + AI Summary Row */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Debt & Refinance */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Scale className="h-4 w-4" />
                Debt & Refinance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-destructive">
                    {portfolioInsights.debt.expiringIn3Months.count}
                  </div>
                  <div className="text-xs text-muted-foreground">Expiring 3mo</div>
                  <div className="text-xs text-muted-foreground">
                    {formatPercent(portfolioInsights.debt.expiringIn3Months.percent, 0)} of debt
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-warning">
                    {portfolioInsights.debt.expiringIn6Months.count}
                  </div>
                  <div className="text-xs text-muted-foreground">Expiring 6mo</div>
                  <div className="text-xs text-muted-foreground">
                    {formatPercent(portfolioInsights.debt.expiringIn6Months.percent, 0)} of debt
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-bold">
                    {portfolioInsights.debt.expiringIn12Months.count}
                  </div>
                  <div className="text-xs text-muted-foreground">Expiring 12mo</div>
                  <div className="text-xs text-muted-foreground">
                    {formatPercent(portfolioInsights.debt.expiringIn12Months.percent, 0)} of debt
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <div className="text-sm font-medium mb-2">Lender Concentration</div>
                {portfolioInsights.debt.lenderConcentration.length > 0 ? (
                  <div className="space-y-2">
                    {portfolioInsights.debt.lenderConcentration.map((lender, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span>{lender.lender}</span>
                        <div className="flex items-center gap-2">
                          <Progress value={lender.percent} className="w-24 h-2" />
                          <span className="w-12 text-right text-muted-foreground">
                            {lender.percent.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No lenders recorded</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Risk Exposure */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Risk Exposure
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    <span className="text-sm font-medium">LTV &gt;85%</span>
                  </div>
                  <div className="text-2xl font-bold">{portfolioInsights.risk.ltvAbove85.count}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatPercent(portfolioInsights.risk.ltvAbove85.percent, 0)} of value
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-warning/10 border border-warning/20">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="h-4 w-4 text-warning" />
                    <span className="text-sm font-medium">LTV 75-85%</span>
                  </div>
                  <div className="text-2xl font-bold">{portfolioInsights.risk.ltvAbove75.count}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatPercent(portfolioInsights.risk.ltvAbove75.percent, 0)} of value
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <div className="text-sm font-medium">EPC Below C</div>
                    <div className="text-xs text-muted-foreground">Need improvement</div>
                  </div>
                  <div className="text-2xl font-bold">{portfolioInsights.risk.epcBelowC.count}</div>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <div className="text-sm font-medium">Pre-2000</div>
                    <div className="text-xs text-muted-foreground">Older buildings</div>
                  </div>
                  <div className="text-2xl font-bold">{portfolioInsights.risk.pre2000Count}</div>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium">Passport Completeness</div>
                    <div className="text-xs text-muted-foreground">
                      {portfolioInsights.operational.propertiesMissingCritical.count} missing critical data
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Progress 
                    value={portfolioInsights.operational.averagePassportCompleteness} 
                    className="w-20 h-2" 
                  />
                  <span className="text-sm font-medium">
                    {portfolioInsights.operational.averagePassportCompleteness.toFixed(0)}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* AI Summary */}
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
                onClick={handleRefreshAI}
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

        {/* Location AI Analysis */}
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
                  onClick={handleRefreshLocationAI}
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
                  onClick={handleGenerateLocationAI}
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

        {/* Action Items */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4" />
              Action Items
            </CardTitle>
            <CardDescription>
              Click to view affected properties
            </CardDescription>
          </CardHeader>
          <CardContent>
            {actionItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No urgent actions required</p>
              </div>
            ) : (
              <div className="space-y-2">
                {actionItems.map((action) => (
                  <button
                    key={action.id}
                    onClick={() => handleActionClick(action)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left"
                  >
                    <div className={`p-2 rounded-full ${
                      action.severity === 'red' 
                        ? 'bg-destructive/10 text-destructive' 
                        : 'bg-warning/10 text-warning'
                    }`}>
                      {action.severity === 'red' ? (
                        <AlertCircle className="h-4 w-4" />
                      ) : (
                        <AlertTriangle className="h-4 w-4" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{action.title}</div>
                      <div className="text-sm text-muted-foreground">{action.description}</div>
                    </div>
                    <Badge variant={action.severity === 'red' ? 'destructive' : 'secondary'}>
                      {action.count}
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

// ============================================================
// Sub-components
// ============================================================

interface MetricCardProps {
  icon: React.ElementType;
  title: string;
  value: string;
  subtitle: string;
  status?: 'positive' | 'negative' | 'neutral';
}

function MetricCard({ icon: Icon, title, value, subtitle, status = 'neutral' }: MetricCardProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-sm text-muted-foreground mb-1">{title}</div>
            <div className={`text-2xl font-bold ${
              status === 'positive' ? 'text-success' :
              status === 'negative' ? 'text-destructive' : ''
            }`}>
              {value}
            </div>
            <div className="text-xs text-muted-foreground mt-1">{subtitle}</div>
          </div>
          <div className="p-2 rounded-lg bg-muted">
            <Icon className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

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

export default InsightsPage;
