import { useMemo } from 'react';
import { Building2, TrendingUp, Percent, PoundSterling, Banknote, Wallet } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { PortalLayout } from '@/components/portal/PortalLayout';
import { useShareholderSession } from '@/hooks/useShareholderSession';
import { useShareholderPortfolioData } from '@/hooks/useShareholderPortfolioData';
import { LoadingState } from '@/components/common/LoadingState';
import { formatGBP, formatPercent } from '@/lib/calculations';

export default function PortalDashboard() {
  const { canViewFinancials } = useShareholderSession();
  const { properties, loansByProperty, performanceByProperty, isLoading } = useShareholderPortfolioData();

  const stats = useMemo(() => {
    if (!properties?.length) return null;

    let totalValue = 0;
    let totalDebt = 0;
    let totalRent = 0;
    let totalCashflow = 0;

    properties.forEach((p) => {
      totalValue += p.current_valuation || 0;

      const propertyLoans = loansByProperty.get(p.id) || [];
      const propertyDebt = propertyLoans.reduce((sum, l) => sum + l.current_balance, 0);
      totalDebt += propertyDebt;

      const perf = performanceByProperty.get(p.id);
      if (perf) {
        totalRent += perf.annual_rent_received || 0;
        totalCashflow += (perf.annual_cash_flow || 0) / 12;
      }
    });

    const totalEquity = totalValue - totalDebt;
    const avgLtv = totalValue > 0 ? (totalDebt / totalValue) * 100 : 0;

    return {
      propertyCount: properties.length,
      totalValue,
      totalEquity,
      totalDebt,
      avgLtv,
      totalAnnualRent: totalRent,
      totalMonthlyCashflow: totalCashflow,
    };
  }, [properties, loansByProperty, performanceByProperty]);

  // Group properties by entity
  const propertiesByEntity = useMemo(() => {
    if (!properties?.length) return [];

    const byEntity = new Map<string, {
      entityName: string;
      entityId: string;
      properties: typeof properties;
    }>();

    properties.forEach((p) => {
      const key = p.entity_id;
      const entityName = p.entity?.entity_name || 'Unknown Entity';

      if (!byEntity.has(key)) {
        byEntity.set(key, { entityName, entityId: p.entity_id, properties: [] });
      }
      byEntity.get(key)!.properties.push(p);
    });

    return Array.from(byEntity.values()).map((group) => {
      let totalValue = 0;
      let totalDebt = 0;
      let totalRent = 0;
      let totalCashflow = 0;

      group.properties.forEach((p) => {
        totalValue += p.current_valuation || 0;
        const propertyLoans = loansByProperty.get(p.id) || [];
        totalDebt += propertyLoans.reduce((sum, l) => sum + l.current_balance, 0);
        const perf = performanceByProperty.get(p.id);
        if (perf) {
          totalRent += perf.annual_rent_received || 0;
          totalCashflow += (perf.annual_cash_flow || 0) / 12;
        }
      });

      return {
        ...group,
        totalValue,
        totalEquity: totalValue - totalDebt,
        totalDebt,
        totalRent,
        totalCashflow,
      };
    });
  }, [properties, loansByProperty, performanceByProperty]);

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
                  <div className="text-2xl font-bold">{formatGBP(stats?.totalValue || 0)}</div>
                  <p className="text-xs text-muted-foreground">Current valuation</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Equity</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-primary">{formatGBP(stats?.totalEquity || 0)}</div>
                  <p className="text-xs text-muted-foreground">Value minus debt</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Average LTV</CardTitle>
                  <Percent className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatPercent(stats?.avgLtv || 0)}</div>
                  <p className="text-xs text-muted-foreground">Loan to value</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Annual Rent</CardTitle>
                  <Banknote className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-success">{formatGBP(stats?.totalAnnualRent || 0)}</div>
                  <p className="text-xs text-muted-foreground">Gross rental income</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Monthly Cashflow</CardTitle>
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${(stats?.totalMonthlyCashflow || 0) >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {formatGBP(stats?.totalMonthlyCashflow || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">Net after debt service</p>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Properties by Entity */}
        {canViewFinancials && propertiesByEntity.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Portfolio by Entity</CardTitle>
              <CardDescription>Financial breakdown grouped by legal owner</CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" className="w-full">
                {propertiesByEntity.map((group) => (
                  <AccordionItem key={group.entityId} value={group.entityId}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center justify-between w-full pr-4">
                        <div className="flex items-center gap-3">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{group.entityName}</span>
                          <Badge variant="secondary">{group.properties.length} properties</Badge>
                        </div>
                        <div className="flex items-center gap-6 text-sm">
                          <span className="text-muted-foreground">
                            Equity: <span className="font-medium text-foreground">{formatGBP(group.totalEquity)}</span>
                          </span>
                          <span className="text-muted-foreground">
                            Cashflow: <span className={`font-medium ${group.totalCashflow >= 0 ? 'text-success' : 'text-destructive'}`}>
                              {formatGBP(group.totalCashflow)}/mo
                            </span>
                          </span>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="pt-2 space-y-2">
                        {group.properties.map((property) => {
                          const propertyLoans = loansByProperty.get(property.id) || [];
                          const debt = propertyLoans.reduce((sum, l) => sum + l.current_balance, 0);
                          const perf = performanceByProperty.get(property.id);
                          return (
                            <div key={property.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                              <div>
                                <p className="font-medium text-sm">{property.address_line_1}</p>
                                <p className="text-xs text-muted-foreground">{property.city}, {property.postcode}</p>
                              </div>
                              <div className="flex items-center gap-6 text-sm">
                                <div className="text-right">
                                  <p className="text-muted-foreground text-xs">Value</p>
                                  <p className="font-medium">{formatGBP(property.current_valuation || 0)}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-muted-foreground text-xs">Rent</p>
                                  <p className="font-medium text-success">{formatGBP(perf?.annual_rent_received || 0)}/yr</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-muted-foreground text-xs">Cashflow</p>
                                  <p className={`font-medium ${(perf?.annual_cash_flow || 0) >= 0 ? 'text-success' : 'text-destructive'}`}>
                                    {formatGBP((perf?.annual_cash_flow || 0) / 12)}/mo
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        )}

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
                        <th className="text-right py-3 px-2 font-medium">Rent</th>
                        <th className="text-right py-3 px-2 font-medium">LTV</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {properties?.map((property) => {
                    const propertyLoans = loansByProperty.get(property.id) || [];
                    const debt = propertyLoans.reduce((sum, l) => sum + l.current_balance, 0);
                    const perf = performanceByProperty.get(property.id);
                    const ltv = property.current_valuation && debt
                      ? (debt / property.current_valuation) * 100
                      : 0;

                    return (
                      <tr key={property.id} className="border-b last:border-0">
                        <td className="py-3 px-2">
                          <div className="font-medium">{property.address_line_1}</div>
                          <div className="text-xs text-muted-foreground">{property.city}, {property.postcode}</div>
                        </td>
                        <td className="py-3 px-2 capitalize">
                          {property.property_type?.replace('_', ' ') || '—'}
                        </td>
                        {canViewFinancials && (
                          <>
                            <td className="py-3 px-2 text-right">{formatGBP(property.current_valuation || 0)}</td>
                            <td className="py-3 px-2 text-right text-success">{formatGBP(perf?.annual_rent_received || 0)}/yr</td>
                            <td className="py-3 px-2 text-right">{formatPercent(ltv)}</td>
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
