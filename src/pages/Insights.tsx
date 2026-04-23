import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown, Users, BarChart3 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { StressTestPanel } from '@/components/property/StressTestPanel';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePropertiesCompat as useProperties } from '@/hooks/usePropertiesCompat';
import { usePropertyPassports } from '@/hooks/usePropertyPassport';
import { usePortfolioAI } from '@/hooks/usePortfolioAI';
import { useLocationAI } from '@/hooks/useLocationAI';
import {
  calculatePortfolioInsights,
  generateActionItems,
  buildAIPromptData,
  type ActionItem,
} from '@/lib/portfolioInsights';
import {
  KeyMetricsGrid,
  DebtRefinanceCard,
  RiskExposureCard,
  AIPortfolioCard,
  LocationAnalysisCard,
  ActionItemsCard,
  OwnershipAttributionSection,
} from '@/components/insights';

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

  // Auto-generate Location AI insights after portfolio insights are ready
  useEffect(() => {
    if (portfolioInsights && properties && locationData.length > 0 && !hasGeneratedLocation && !locationLoading && hasGeneratedAI) {
      const summaryData = buildAIPromptData(portfolioInsights, properties);
      generateLocationInsights(locationData, summaryData);
      setHasGeneratedLocation(true);
    }
  }, [portfolioInsights, properties, locationData, hasGeneratedLocation, locationLoading, hasGeneratedAI, generateLocationInsights]);

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
        <EmptyState
          icon={BarChart3}
          title="Not enough data yet"
          description="Add at least 2 properties with financial data to unlock portfolio insights."
          action={{ label: 'Add Property', href: '/properties/new' }}
          className="mt-8"
        />
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

        {/* Tabs for different insight views */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
           <TabsTrigger value="overview" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="stress-test" className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              Stress Test
            </TabsTrigger>
            <TabsTrigger value="ownership" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Ownership Attribution
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <KeyMetricsGrid portfolioInsights={portfolioInsights} />

            <div className="grid gap-6 lg:grid-cols-2">
              <DebtRefinanceCard portfolioInsights={portfolioInsights} navigate={navigate} />
              <RiskExposureCard portfolioInsights={portfolioInsights} />
            </div>

            <AIPortfolioCard
              aiInsights={aiInsights}
              aiLoading={aiLoading}
              onRefresh={handleRefreshAI}
              navigate={navigate}
            />

            <LocationAnalysisCard
              locationInsights={locationInsights}
              locationLoading={locationLoading}
              onGenerate={handleGenerateLocationAI}
              onRefresh={handleRefreshLocationAI}
              hasGenerated={hasGeneratedLocation}
            />

            <ActionItemsCard
              actionItems={actionItems}
              onActionClick={handleActionClick}
            />
          </TabsContent>

          {/* Stress Test Tab */}
          <TabsContent value="stress-test">
            <StressTestPanel />
          </TabsContent>

          {/* Ownership Attribution Tab */}
          <TabsContent value="ownership">
            <OwnershipAttributionSection properties={properties || []} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

export default InsightsPage;
