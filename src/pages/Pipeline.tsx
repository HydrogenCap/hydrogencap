import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Construction,
  MapPin,
  TrendingUp,
  Calendar,
  ArrowRight,
  Plus,
  Handshake,
  ClipboardCheck,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { usePropertiesCompat as useProperties } from '@/hooks/usePropertiesCompat';
import { supabaseAny } from '@/integrations/supabase/client';
import { formatGBP, formatDateUK } from '@/lib/calculations';
import { DealPipelineBoard } from '@/components/pipeline/DealPipelineBoard';
import { DealSourcingForm } from '@/components/pipeline/DealSourcingForm';
import { DueDiligenceChecklist } from '@/components/pipeline/DueDiligenceChecklist';
import { OfferTracker } from '@/components/pipeline/OfferTracker';
import { PostAcquisitionWizard } from '@/components/pipeline/PostAcquisitionWizard';
import { type DealPipelineItem } from '@/hooks/useDealPipeline';

// Hook to fetch all go-live checklists
function useAllGoLiveChecklists() {
  return useQuery({
    queryKey: ['go_live_checklists'],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('go_live_checklists')
        .select('*');
      if (error) throw error;
      return data;
    },
  });
}

// ── Go-Live Tab (existing functionality) ────────────────────────────────

function GoLiveTab() {
  const { data: properties, isLoading } = useProperties();
  const { data: checklists } = useAllGoLiveChecklists();

  const developmentProperties = useMemo(() => {
    return properties?.filter(p => p.lifecycle_type === 'development') || [];
  }, [properties]);

  const stats = useMemo(() => {
    const totalBudget = developmentProperties.reduce((sum, p) => {
      return sum + (p.purchase_price_gbp ? Number(p.purchase_price_gbp) : 0);
    }, 0);
    const projectedValue = developmentProperties.reduce((sum, p) => {
      return sum + (p.current_value_gbp ? Number(p.current_value_gbp) : 0);
    }, 0);
    return {
      count: developmentProperties.length,
      totalBudget,
      projectedValue,
      projectedProfit: projectedValue - totalBudget,
    };
  }, [developmentProperties]);

  const getChecklistProgress = (propertyId: string) => {
    const checklist = (checklists as Array<{ property_id: string } & Record<string, unknown>> | undefined)
      ?.find((c) => c.property_id === propertyId);
    if (!checklist) return 0;
    const fields = Object.entries(checklist).filter(([key]) =>
      key.startsWith('setup_') ||
      key.startsWith('build_') ||
      key.startsWith('compliance_') ||
      key.startsWith('finance_')
    );
    const completed = fields.filter(([, value]) => value === true).length;
    return Math.round((completed / fields.length) * 100);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary KPIs */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Projects</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.count}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Investment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatGBP(stats.totalBudget)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Projected GDV</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatGBP(stats.projectedValue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Projected Profit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.projectedProfit > 0 ? 'text-success' : 'text-destructive'}`}>
              {formatGBP(stats.projectedProfit)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Project Cards */}
      {developmentProperties.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Construction className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Development Projects</h3>
            <p className="text-muted-foreground text-center mb-4">
              Add a new property and set its lifecycle to "Development" to track it here.
            </p>
            <Button asChild>
              <Link to="/properties/new">
                <Plus className="h-4 w-4 mr-2" />
                Add First Project
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {developmentProperties.map(property => {
            const progress = getChecklistProgress(property.id);
            const purchasePrice = property.purchase_price_gbp ? Number(property.purchase_price_gbp) : 0;
            const projectedValue = property.current_value_gbp ? Number(property.current_value_gbp) : 0;
            const profit = projectedValue - purchasePrice;

            return (
              <Card key={property.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{property.address_line}</CardTitle>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                        <MapPin className="h-3 w-3" />
                        {property.postcode || property.town_city || 'Location not set'}
                      </div>
                    </div>
                    <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30">
                      Development
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Go-Live Progress</span>
                      <span className="font-medium">{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground block">Purchase</span>
                      <span className="font-medium">{formatGBP(purchasePrice)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Projected GDV</span>
                      <span className="font-medium">{formatGBP(projectedValue)}</span>
                    </div>
                  </div>
                  {property.original_purchase_date && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      Acquired {formatDateUK(property.original_purchase_date)}
                    </div>
                  )}
                  {projectedValue > 0 && (
                    <div className={`flex items-center gap-1 text-sm ${profit > 0 ? 'text-success' : 'text-destructive'}`}>
                      <TrendingUp className="h-3 w-3" />
                      {profit > 0 ? '+' : ''}{formatGBP(profit)} projected profit
                    </div>
                  )}
                  <Button variant="outline" size="sm" className="w-full mt-2" asChild>
                    <Link to={`/properties/${property.id}`}>
                      View Project
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main Pipeline Page ──────────────────────────────────────────────────

export default function Pipeline() {
  const [newDealOpen, setNewDealOpen] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<DealPipelineItem | null>(null);

  const showOffer = selectedDeal && ['offer_made', 'offer_accepted'].includes(selectedDeal.stage);
  const showOnboarding = selectedDeal?.stage === 'completed';

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Construction className="h-6 w-6" />
              Pipeline
            </h1>
            <p className="text-muted-foreground mt-1">
              Deal sourcing, due diligence, and project management
            </p>
          </div>
          <Button onClick={() => setNewDealOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Deal
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="deals">
          <TabsList>
            <TabsTrigger value="deals" className="flex items-center gap-1.5">
              <Handshake className="h-4 w-4" />
              Deal Pipeline
            </TabsTrigger>
            <TabsTrigger value="dd" className="flex items-center gap-1.5">
              <ClipboardCheck className="h-4 w-4" />
              Due Diligence
            </TabsTrigger>
            <TabsTrigger value="golive" className="flex items-center gap-1.5">
              <Construction className="h-4 w-4" />
              Go Live
            </TabsTrigger>
          </TabsList>

          <TabsContent value="deals">
            <DealPipelineBoard onSelectDeal={setSelectedDeal} />
          </TabsContent>

          <TabsContent value="dd">
            <DueDiligenceChecklist />
          </TabsContent>

          <TabsContent value="golive">
            <GoLiveTab />
          </TabsContent>
        </Tabs>
      </div>

      {/* New Deal Sheet */}
      <Sheet open={newDealOpen} onOpenChange={setNewDealOpen}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Add New Deal</SheetTitle>
            <SheetDescription>
              Add a property to your acquisition pipeline.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <DealSourcingForm onSuccess={() => setNewDealOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      {/* Deal Detail Sheet — Offer Tracker or Post-Acquisition */}
      <Sheet open={!!selectedDeal} onOpenChange={open => !open && setSelectedDeal(null)}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {showOnboarding
                ? 'Post-Acquisition Onboarding'
                : showOffer
                  ? 'Offer Tracker'
                  : selectedDeal?.address || 'Deal Details'}
            </SheetTitle>
            <SheetDescription>
              {showOnboarding
                ? 'Set up this property in TenureIQ'
                : showOffer
                  ? 'Track offers and negotiations'
                  : `${selectedDeal?.address || ''} ${selectedDeal?.postcode || ''}`}
            </SheetDescription>
          </SheetHeader>
          {selectedDeal && (
            <div className="mt-6">
              {showOnboarding ? (
                <PostAcquisitionWizard
                  deal={selectedDeal}
                  onComplete={() => setSelectedDeal(null)}
                />
              ) : showOffer ? (
                <OfferTracker deal={selectedDeal} />
              ) : (
                <DealDetailView deal={selectedDeal} />
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}

// ── Simple Deal Detail View ─────────────────────────────────────────────

function DealDetailView({ deal }: { deal: DealPipelineItem }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-muted-foreground block">Address</span>
          <span className="font-medium">{deal.address}</span>
        </div>
        <div>
          <span className="text-muted-foreground block">Postcode</span>
          <span className="font-medium">{deal.postcode || '\u2014'}</span>
        </div>
        <div>
          <span className="text-muted-foreground block">Asking Price</span>
          <span className="font-medium">{formatGBP(deal.asking_price)}</span>
        </div>
        <div>
          <span className="text-muted-foreground block">Est. Rent</span>
          <span className="font-medium">
            {deal.estimated_rental ? `${formatGBP(deal.estimated_rental)}/mo` : '\u2014'}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground block">Est. Yield</span>
          <span className="font-medium">
            {deal.estimated_yield ? `${deal.estimated_yield}%` : '\u2014'}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground block">Beds</span>
          <span className="font-medium">{deal.beds || '\u2014'}</span>
        </div>
        <div>
          <span className="text-muted-foreground block">Property Type</span>
          <span className="font-medium">{deal.property_type || '\u2014'}</span>
        </div>
        <div>
          <span className="text-muted-foreground block">Source</span>
          <span className="font-medium">{deal.listing_source || '\u2014'}</span>
        </div>
      </div>

      {/* Agent details */}
      {(deal.agent_name || deal.agent_company) && (
        <div className="border-t pt-3">
          <p className="text-sm font-medium mb-2">Agent</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {deal.agent_name && (
              <div>
                <span className="text-muted-foreground">Name: </span>
                {deal.agent_name}
              </div>
            )}
            {deal.agent_company && (
              <div>
                <span className="text-muted-foreground">Company: </span>
                {deal.agent_company}
              </div>
            )}
            {deal.agent_phone && (
              <div>
                <span className="text-muted-foreground">Phone: </span>
                {deal.agent_phone}
              </div>
            )}
            {deal.agent_email && (
              <div>
                <span className="text-muted-foreground">Email: </span>
                {deal.agent_email}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Listing link */}
      {deal.listing_url && (
        <div className="border-t pt-3">
          <a
            href={deal.listing_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline"
          >
            View listing
          </a>
        </div>
      )}

      {/* Notes */}
      {deal.notes && (
        <div className="border-t pt-3">
          <p className="text-sm font-medium mb-1">Notes</p>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{deal.notes}</p>
        </div>
      )}
    </div>
  );
}
