import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Edit2, MapPin, Bed, Home, Building, Trash2, Bath, FileText, Image } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { ActivityTimeline } from '@/components/activity/ActivityTimeline';
import { OwnershipSection, FinancialAttributionCard } from '@/components/ownership';
import { LocationRegistryCard, PropertyMediaHeader, FinanceSummaryCard } from '@/components/property';
import { PassportForm } from '@/components/passport';
import { PhotoGallery } from '@/components/photos';
import { FloorplanCard } from '@/components/floorplans';
import { ComplianceTab } from '@/components/compliance';
import { LifecycleSwitcher, LifecycleBadge } from '@/components/property/LifecycleSwitcher';
import { LifecycleType } from '@/contexts/LifecycleFilterContext';
import { useSearchParams } from 'react-router-dom';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useProperty, useDeleteProperty } from '@/hooks/useProperties';
import { useToast } from '@/hooks/use-toast';
import {
  formatGBP,
  formatPercent,
  calculateLTV,
  calculateEquity,
  getEffectiveCosts,
  calculateNetRent,
  calculateMonthlyCashflowAfterDebt,
  calculateYield,
  calculateROCE,
  getLTVStatus,
  getEPCStatus,
} from '@/lib/calculations';

function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get('tab') || 'overview';
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: property, isLoading, error } = useProperty(id);
  const deleteProperty = useDeleteProperty();

  const handleDelete = async () => {
    if (!id) return;
    
    try {
      await deleteProperty.mutateAsync(id);
      toast({
        title: 'Property deleted',
        description: 'The property has been removed from your portfolio.',
      });
      navigate('/properties');
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to delete property.',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error || !property) {
    return (
      <AppLayout>
        <div className="p-8 text-center">
          <p className="text-destructive mb-4">Property not found</p>
          <Button asChild>
            <Link to="/properties">Back to Portfolio</Link>
          </Button>
        </div>
      </AppLayout>
    );
  }

  // Calculate metrics
  const currentYear = new Date().getFullYear();
  const loan = property.loans?.[0];
  const income = property.income?.find(i => i.year === currentYear);
  const costs = property.costs?.find(c => c.year === currentYear);

  const mortgageBalance = loan?.current_mortgage_balance_gbp ? Number(loan.current_mortgage_balance_gbp) : null;
  const currentValue = property.current_value_gbp ? Number(property.current_value_gbp) : null;
  const annualRent = income?.annual_rent_gbp ? Number(income.annual_rent_gbp) : null;
  
  // Use effective costs (auto-calculated with manual overrides)
  const effectiveCosts = getEffectiveCosts(annualRent, currentValue, costs);
  const totalCosts = effectiveCosts.total;

  const ltv = calculateLTV(mortgageBalance, currentValue);
  const equity = calculateEquity(currentValue, mortgageBalance);
  const netRent = calculateNetRent(annualRent, totalCosts);
  const mortgagePayment = loan?.mortgage_payment_gbp ? Number(loan.mortgage_payment_gbp) : null;
  const monthlyCashflow = calculateMonthlyCashflowAfterDebt(annualRent, totalCosts, mortgagePayment);
  const yieldPercent = calculateYield(netRent, currentValue);
  const roce = calculateROCE(netRent, equity);

  const ltvStatus = getLTVStatus(ltv);
  const epcStatus = getEPCStatus(property.epc_rating);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/properties')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold">{property.address_line}</h1>
                <LifecycleSwitcher 
                  propertyId={property.id}
                  currentLifecycle={(property.lifecycle_type as LifecycleType) || 'development'}
                  operationalDate={property.operational_date}
                />
              </div>
              <div className="flex items-center gap-4 text-muted-foreground mt-1">
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {property.town_city || property.area_name || property.postcode}
                </span>
                {property.beds && (
                  <span className="flex items-center gap-1">
                    <Bed className="h-4 w-4" />
                    {property.beds} bed
                  </span>
                )}
                {property.bathrooms && (
                  <span className="flex items-center gap-1">
                    <Bath className="h-4 w-4" />
                    {property.bathrooms} bath
                  </span>
                )}
                {property.property_type && (
                  <span className="flex items-center gap-1">
                    <Home className="h-4 w-4" />
                    {property.property_type}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link to={`/properties/${id}/edit`}>
                <Edit2 className="h-4 w-4 mr-2" />
                Edit
              </Link>
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="icon" className="text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Property</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete {property.address_line}? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* KPI Summary Row */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Equity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{formatGBP(equity)}</div>
              <p className="text-xs text-muted-foreground">Value: {formatGBP(currentValue)}</p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">LTV</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${
                ltvStatus === 'danger' ? 'text-destructive' :
                ltvStatus === 'warning' ? 'text-warning' : ''
              }`}>
                {formatPercent(ltv)}
              </div>
              <p className="text-xs text-muted-foreground">Mortgage: {formatGBP(mortgageBalance)}</p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Cashflow</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${monthlyCashflow && monthlyCashflow >= 0 ? 'text-success' : 'text-destructive'}`}>
                {formatGBP(monthlyCashflow)}
              </div>
              <p className="text-xs text-muted-foreground">After debt service</p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Net Yield</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${yieldPercent && yieldPercent >= 0 ? 'text-success' : ''}`}>
                {formatPercent(yieldPercent)}
              </div>
              <p className="text-xs text-muted-foreground">ROCE: {formatPercent(roce)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs - Simplified to 5 */}
        <Tabs defaultValue={defaultTab} className="space-y-4">
          <TabsList className="bg-muted">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="finance">Finance</TabsTrigger>
            <TabsTrigger value="operations">Operations</TabsTrigger>
            <TabsTrigger value="compliance">Compliance</TabsTrigger>
            <TabsTrigger value="media">Media & Docs</TabsTrigger>
          </TabsList>

          {/* OVERVIEW TAB */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Property Details */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle>Property Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Type</span>
                    <span>{property.property_type || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Bedrooms</span>
                    <span>{property.beds ?? '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Bathrooms</span>
                    <span>{property.bathrooms ?? '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">EPC Rating</span>
                    <span>
                      {property.epc_required === false ? (
                        <span className="text-muted-foreground">N/A (Listed)</span>
                      ) : property.epc_rating ? (
                        <Badge variant="outline" className={epcStatus === 'warning' ? 'status-warning border' : ''}>
                          {property.epc_rating}
                        </Badge>
                      ) : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tenure</span>
                    <span className="capitalize">{property.tenure || '—'}</span>
                  </div>
                  {property.listed_status && property.listed_status !== 'Not listed' && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Listed Status</span>
                      <Badge variant="outline">{property.listed_status}</Badge>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Quick Performance */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle>Quick Performance</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Annual Rent</span>
                    <span>{formatGBP(annualRent)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Operating Costs</span>
                    <span className="text-destructive">-{formatGBP(totalCosts)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">NOI</span>
                    <span className={netRent && netRent >= 0 ? 'text-success' : 'text-destructive'}>
                      {formatGBP(netRent)}
                    </span>
                  </div>
                  {mortgagePayment && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Debt Service</span>
                        <span className="text-destructive">-{formatGBP(mortgagePayment * 12)}/yr</span>
                      </div>
                      <div className="border-t pt-2 flex justify-between font-medium">
                        <span>Net Cashflow</span>
                        <span className={monthlyCashflow && monthlyCashflow >= 0 ? 'text-success' : 'text-destructive'}>
                          {formatGBP(monthlyCashflow)}/mo
                        </span>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Location & Registry */}
            <LocationRegistryCard
              propertyId={id!}
              latitude={property.latitude ? Number(property.latitude) : null}
              longitude={property.longitude ? Number(property.longitude) : null}
              titleNumber={property.title_number}
              tenure={property.tenure}
              leaseYearsRemaining={property.lease_years_remaining}
              uprn={property.uprn}
              landRegistryLink={property.land_registry_link}
              address={`${property.address_line}, ${property.postcode || ''}`}
            />

            {/* Ownership Section */}
            <OwnershipSection propertyId={id!} />

            {/* Financial Attribution */}
            <FinancialAttributionCard propertyId={id!} />

            {/* Notes */}
            {property.notes && (
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle>Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground whitespace-pre-wrap">{property.notes}</p>
                </CardContent>
              </Card>
            )}

            {/* Activity */}
            <ActivityTimeline propertyId={id} showHeader={true} showAddNote={true} limit={5} />
          </TabsContent>

          {/* FINANCE TAB - Unified */}
          <TabsContent value="finance" className="space-y-4">
            <FinanceSummaryCard
              currentValue={currentValue}
              purchasePrice={property.purchase_price_gbp ? Number(property.purchase_price_gbp) : null}
              purchaseDate={property.original_purchase_date}
              annualRent={annualRent}
              loan={loan || null}
              effectiveCosts={effectiveCosts}
              equity={equity}
              ltv={ltv}
              netRent={netRent}
              monthlyCashflow={monthlyCashflow}
              yieldPercent={yieldPercent}
              roce={roce}
            />
          </TabsContent>

          {/* OPERATIONS TAB - Renamed from Passport */}
          <TabsContent value="operations">
            <PassportForm propertyId={id!} highlightMissing={searchParams.has('highlight')} />
          </TabsContent>

          {/* COMPLIANCE TAB */}
          <TabsContent value="compliance" className="space-y-4">
            <ComplianceTab 
              propertyId={id!} 
              propertyAddress={property?.address_line || ''} 
              lifecycleType={(property?.lifecycle_type as LifecycleType) || 'development'}
            />
          </TabsContent>

          {/* MEDIA & DOCS TAB - Merged */}
          <TabsContent value="media" className="space-y-6">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Image className="h-4 w-4" />
              <span className="font-medium">Photos & Gallery</span>
            </div>
            <PhotoGallery propertyId={id!} />
            
            <div className="flex items-center gap-2 text-muted-foreground pt-4">
              <FileText className="h-4 w-4" />
              <span className="font-medium">Floor Plans</span>
            </div>
            <FloorplanCard propertyId={id!} showAllFloorplans={true} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

export default PropertyDetailPage;
