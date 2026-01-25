import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Edit2, MapPin, Bed, Home, Building, Trash2, Bath } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { ActivityTimeline } from '@/components/activity/ActivityTimeline';
import { OwnershipCard, OwnershipEditor, BeneficialAttributionCard } from '@/components/ownership';
import { LocationRegistryCard } from '@/components/property';
import { PassportForm } from '@/components/passport';
import { PhotoGallery } from '@/components/photos';
import { FloorplanCard } from '@/components/floorplans';
import type { PropertyOwnershipWithEntity } from '@/hooks/useOwnership';
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
  formatDateUK,
  calculateLTV,
  calculateEquity,
  getEffectiveCosts,
  calculateNetRent,
  calculateMonthlyCashflow,
  calculateYield,
  calculateROCE,
  getLTVStatus,
  getEPCStatus,
  getExpiryStatus,
  daysUntil,
} from '@/lib/calculations';
import { calculateRentPerBedroom, formatPaymentGBP } from '@/lib/mortgageCalculations';

function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get('tab') || 'overview';
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: property, isLoading, error } = useProperty(id);
  const deleteProperty = useDeleteProperty();
  
  // Ownership editor state
  const [ownershipEditorOpen, setOwnershipEditorOpen] = useState(false);
  const [editingOwnership, setEditingOwnership] = useState<PropertyOwnershipWithEntity | null>(null);
  const [defaultOwnershipLevel, setDefaultOwnershipLevel] = useState<'Property' | 'SPV_Shareholding'>('Property');

  const handleAddOwnership = (level: 'Property' | 'SPV_Shareholding') => {
    setEditingOwnership(null);
    setDefaultOwnershipLevel(level);
    setOwnershipEditorOpen(true);
  };

  const handleEditOwnership = (ownership: PropertyOwnershipWithEntity) => {
    setEditingOwnership(ownership);
    setOwnershipEditorOpen(true);
  };

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
            <Link to="/properties">Back to Properties</Link>
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
  const monthlyCashflow = calculateMonthlyCashflow(netRent);
  const yieldPercent = calculateYield(netRent, currentValue);
  const roce = calculateROCE(netRent, equity);
  const rentPerBedroom = calculateRentPerBedroom(annualRent, property.beds ? Number(property.beds) : null);

  const ltvStatus = getLTVStatus(ltv);
  const epcStatus = getEPCStatus(property.epc_rating);
  const fixedRateStatus = loan?.fixed_rate_expires ? getExpiryStatus(loan.fixed_rate_expires) : null;
  const daysToExpiry = loan?.fixed_rate_expires ? daysUntil(loan.fixed_rate_expires) : null;

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
              <h1 className="text-2xl font-bold text-foreground">{property.address_line}</h1>
              <div className="flex items-center gap-4 mt-1 text-muted-foreground">
                {property.postcode && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {property.postcode}
                  </span>
                )}
                {property.area_name && <span>{property.area_name}</span>}
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
            <Button variant="outline" asChild>
              <Link to={`/properties/${id}/edit`}>
                <Edit2 className="h-4 w-4 mr-2" />
                Edit
              </Link>
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="icon">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Property</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete this property? This action cannot be undone
                    and will remove all associated data including loans, income, costs, and documents.
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

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Value</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatGBP(currentValue)}</div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Mortgage</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatGBP(mortgageBalance)}</div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Equity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{formatGBP(equity)}</div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">LTV</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <span className={`text-2xl font-bold ${
                  ltvStatus === 'danger' ? 'text-destructive' :
                  ltvStatus === 'warning' ? 'text-warning' : ''
                }`}>
                  {formatPercent(ltv)}
                </span>
              </div>
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
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue={defaultTab} className="space-y-4">
          <TabsList className="bg-muted flex-wrap">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="finance">Finance & Refinance</TabsTrigger>
            <TabsTrigger value="costs">Costs</TabsTrigger>
            <TabsTrigger value="passport">Passport</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="photos">Photos</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            {/* Floorplan - High visibility */}
            <FloorplanCard propertyId={id!} />

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
                        <span className="text-muted-foreground">N/A (Listed building)</span>
                      ) : property.epc_rating ? (
                        <Badge variant="outline" className={epcStatus === 'warning' ? 'status-warning border' : ''}>
                          {property.epc_rating}
                        </Badge>
                      ) : '—'}
                    </span>
                  </div>
                  {property.listed_status && property.listed_status !== 'Not listed' && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Listed Status</span>
                      <Badge variant="outline">{property.listed_status}</Badge>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Performance */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle>Performance</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Annual Rent</span>
                    <span>{formatGBP(annualRent)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Annual Costs</span>
                    <span>{formatGBP(totalCosts)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Net Rent</span>
                    <span className={netRent && netRent >= 0 ? 'text-success' : 'text-destructive'}>
                      {formatGBP(netRent)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Yield</span>
                    <span className={yieldPercent && yieldPercent >= 0 ? 'text-success' : 'text-destructive'}>
                      {formatPercent(yieldPercent)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ROCE</span>
                    <span className={roce && roce >= 0 ? 'text-success' : 'text-destructive'}>
                      {formatPercent(roce)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Rent / Bedroom</span>
                    <span>
                      {rentPerBedroom.monthly !== null 
                        ? `${formatPaymentGBP(rentPerBedroom.monthly)}/mo` 
                        : '—'}
                    </span>
                  </div>
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
            <OwnershipCard
              propertyId={id!}
              onAddOwnership={handleAddOwnership}
              onEditOwnership={handleEditOwnership}
            />

            {/* Beneficial Attribution */}
            <BeneficialAttributionCard propertyId={id!} />

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

            {/* Ownership Editor Dialog */}
            <OwnershipEditor
              propertyId={id!}
              open={ownershipEditorOpen}
              onOpenChange={setOwnershipEditorOpen}
              editingOwnership={editingOwnership}
              defaultLevel={defaultOwnershipLevel}
            />
          </TabsContent>

          <TabsContent value="finance" className="space-y-4">
            {loan ? (
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle>Mortgage Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Lender</span>
                      <span>{loan.lender || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Balance</span>
                      <span>{formatGBP(mortgageBalance)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Monthly Payment</span>
                      <span>{loan.mortgage_payment_gbp ? formatGBP(Number(loan.mortgage_payment_gbp)) : '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Type</span>
                      <span className="capitalize">{loan.mortgage_type || loan.capital_or_interest || '—'}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle>Rate Diary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Current Rate</span>
                      <span>{loan.interest_rate_percent ? `${loan.interest_rate_percent}%` : '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Rate Type</span>
                      <span className="capitalize">{loan.fixed_or_variable || '—'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Fixed Expires</span>
                      <span className="flex items-center gap-2">
                        {loan.fixed_rate_expires ? (
                          <>
                            {formatDateUK(loan.fixed_rate_expires)}
                            {fixedRateStatus && fixedRateStatus !== 'ok' && (
                              <Badge 
                                variant="outline"
                                className={
                                  fixedRateStatus === 'expired' ? 'status-danger border' :
                                  fixedRateStatus === 'critical' ? 'status-danger border' :
                                  'status-warning border'
                                }
                              >
                                {daysToExpiry && daysToExpiry <= 0 ? 'Expired' : `${daysToExpiry}d`}
                              </Badge>
                            )}
                          </>
                        ) : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">SVR Rate</span>
                      <span>{loan.reversion_rate_percent ? `${loan.reversion_rate_percent}%` : '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Broker</span>
                      <span>{loan.broker_name || '—'}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card className="bg-card border-border">
                <CardContent className="py-8 text-center text-muted-foreground">
                  <Building className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No mortgage recorded for this property</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="costs">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle>Annual Costs ({currentYear})</CardTitle>
              </CardHeader>
              <CardContent>
                {costs ? (
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Management</span>
                      <div className="text-right">
                        <span>{formatGBP(effectiveCosts.management)}</span>
                        {effectiveCosts.managementSource === 'auto' && (
                          <Badge variant="outline" className="ml-2 text-xs">Auto</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Bills</span>
                      <span>{formatGBP(effectiveCosts.bills)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Insurance</span>
                      <div className="text-right">
                        <span>{formatGBP(effectiveCosts.insurance)}</span>
                        {effectiveCosts.insuranceSource === 'auto' && (
                          <Badge variant="outline" className="ml-2 text-xs">Auto</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Repairs/Maintenance</span>
                      <div className="text-right">
                        <span>{formatGBP(effectiveCosts.repairs)}</span>
                        {effectiveCosts.repairsSource === 'auto' && (
                          <Badge variant="outline" className="ml-2 text-xs">Auto</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Compliance</span>
                      <span>{formatGBP(effectiveCosts.compliance)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Other</span>
                      <span>{formatGBP(effectiveCosts.other)}</span>
                    </div>
                    <div className="border-t border-border pt-3 flex justify-between font-medium">
                      <span>Total</span>
                      <span>{formatGBP(totalCosts)}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-4">No costs recorded for {currentYear}</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="passport">
            <PassportForm propertyId={id!} highlightMissing={searchParams.has('highlight')} />
          </TabsContent>

          <TabsContent value="documents" className="space-y-4">
            {/* Floorplans Section */}
            <FloorplanCard propertyId={id!} showAllFloorplans={true} />
            
            {/* Other Documents */}
            <Card className="bg-card border-border">
              <CardContent className="py-8 text-center text-muted-foreground">
                <p>Document management coming soon</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="photos" className="space-y-6">
            <PhotoGallery propertyId={id!} />
            <FloorplanCard propertyId={id!} />
          </TabsContent>

          <TabsContent value="activity">
            <ActivityTimeline propertyId={id} showHeader={false} showAddNote={true} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

export default PropertyDetailPage;
