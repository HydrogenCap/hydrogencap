import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  Construction, 
  MapPin, 
  PoundSterling, 
  TrendingUp, 
  Calendar,
  ArrowRight,
  Plus,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { usePropertiesCompat as useProperties } from '@/hooks/usePropertiesCompat';
import { supabase } from '@/integrations/supabase/client';
import { formatGBP, formatDateUK } from '@/lib/calculations';

// Hook to fetch all go-live checklists
function useAllGoLiveChecklists() {
  return useQuery({
    queryKey: ['go_live_checklists'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('go_live_checklists')
        .select('*');
      if (error) throw error;
      return data;
    },
  });
}

export default function Pipeline() {
  const { data: properties, isLoading } = useProperties();
  const { data: checklists } = useAllGoLiveChecklists();

  // Filter to development properties only
  const developmentProperties = useMemo(() => {
    return properties?.filter(p => p.lifecycle_type === 'development') || [];
  }, [properties]);

  // Calculate summary stats
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

  // Get checklist progress for a property
  const getChecklistProgress = (propertyId: string) => {
    const checklist = checklists?.find(c => c.property_id === propertyId);
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
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Construction className="h-6 w-6" />
              Development Pipeline
            </h1>
            <p className="text-muted-foreground mt-1">
              Track renovation projects and development properties
            </p>
          </div>
          <Button asChild>
            <Link to="/properties/new">
              <Plus className="h-4 w-4 mr-2" />
              Add Project
            </Link>
          </Button>
        </div>

        {/* Summary KPIs */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Projects
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.count}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Investment
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatGBP(stats.totalBudget)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Projected GDV
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatGBP(stats.projectedValue)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Projected Profit
              </CardTitle>
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
                        <CardTitle className="text-base">
                          {property.address_line}
                        </CardTitle>
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
                    {/* Progress */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Go-Live Progress</span>
                        <span className="font-medium">{progress}%</span>
                      </div>
                      <Progress value={progress} className="h-2" />
                    </div>

                    {/* Financials */}
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

                    {/* Purchase Date */}
                    {property.original_purchase_date && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        Acquired {formatDateUK(property.original_purchase_date)}
                      </div>
                    )}

                    {/* Profit indicator */}
                    {projectedValue > 0 && (
                      <div className={`flex items-center gap-1 text-sm ${profit > 0 ? 'text-success' : 'text-destructive'}`}>
                        <TrendingUp className="h-3 w-3" />
                        {profit > 0 ? '+' : ''}{formatGBP(profit)} projected profit
                      </div>
                    )}

                    {/* View button */}
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
    </AppLayout>
  );
}
