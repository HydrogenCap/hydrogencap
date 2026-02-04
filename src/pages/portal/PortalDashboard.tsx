import { useMemo } from 'react';
import { Building2, TrendingUp, Percent, PoundSterling } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PortalLayout } from '@/components/portal/PortalLayout';
import { useShareholderSession } from '@/hooks/useShareholderSession';
import { useShareholderPortfolioData } from '@/hooks/useShareholderPortfolioData';
import { LoadingState } from '@/components/common/LoadingState';
import { formatGBP, formatPercent } from '@/lib/calculations';

export default function PortalDashboard() {
  const { canViewFinancials } = useShareholderSession();
  const { properties, isLoading } = useShareholderPortfolioData();

  const stats = useMemo(() => {
    if (!properties?.length) return null;

    const totalValue = properties.reduce((sum, p) => sum + (p.current_value_gbp || 0), 0);
    const totalDebt = properties.reduce((sum, p) => {
      const loan = p.loans?.[0];
      return sum + (loan?.current_mortgage_balance_gbp || 0);
    }, 0);
    const totalEquity = totalValue - totalDebt;
    const avgLtv = totalValue > 0 ? (totalDebt / totalValue) * 100 : 0;

    return {
      propertyCount: properties.length,
      totalValue,
      totalEquity,
      totalDebt,
      avgLtv,
    };
  }, [properties]);

  if (isLoading) {
    return (
      <PortalLayout>
        <LoadingState text="Loading portfolio..." />
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Portfolio Overview</h1>
          <p className="text-muted-foreground">
            Welcome to your read-only investor portal
          </p>
        </div>

        {/* Key Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Properties</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.propertyCount || 0}</div>
              <p className="text-xs text-muted-foreground">Total assets</p>
            </CardContent>
          </Card>

          {canViewFinancials && (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Portfolio Value</CardTitle>
                  <PoundSterling className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatGBP(stats?.totalValue || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">Current valuation</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Equity</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-primary">
                    {formatGBP(stats?.totalEquity || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">Value minus debt</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Average LTV</CardTitle>
                  <Percent className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatPercent(stats?.avgLtv || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">Loan to value</p>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Property Summary Table */}
        <Card>
          <CardHeader>
            <CardTitle>Property Summary</CardTitle>
            <CardDescription>Overview of all properties in the portfolio</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium">Address</th>
                    <th className="text-left py-3 px-2 font-medium">Type</th>
                    {canViewFinancials && (
                      <>
                        <th className="text-right py-3 px-2 font-medium">Value</th>
                        <th className="text-right py-3 px-2 font-medium">LTV</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {properties?.map((property) => {
                    const loan = property.loans?.[0];
                    const ltv = property.current_value_gbp && loan?.current_mortgage_balance_gbp
                      ? (loan.current_mortgage_balance_gbp / property.current_value_gbp) * 100
                      : 0;

                    return (
                      <tr key={property.id} className="border-b last:border-0">
                        <td className="py-3 px-2">
                          <div className="font-medium">{property.address_line}</div>
                          <div className="text-xs text-muted-foreground">
                            {property.town_city}, {property.postcode}
                          </div>
                        </td>
                        <td className="py-3 px-2 capitalize">
                          {property.property_type?.replace('_', ' ') || '—'}
                        </td>
                        {canViewFinancials && (
                          <>
                            <td className="py-3 px-2 text-right">
                              {formatGBP(property.current_value_gbp || 0)}
                            </td>
                            <td className="py-3 px-2 text-right">
                              {formatPercent(ltv)}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {!canViewFinancials && (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center text-muted-foreground">
              Financial details are restricted. Contact the portfolio owner for access.
            </CardContent>
          </Card>
        )}
      </div>
    </PortalLayout>
  );
}
