import { useMemo } from 'react';
import { Building2, TrendingUp, Percent, PoundSterling, Banknote, Wallet, FileText } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { PortalLayout } from '@/components/portal/PortalLayout';
import { useShareholderSession } from '@/hooks/useShareholderSession';
import { useShareholderPortfolioData } from '@/hooks/useShareholderPortfolioData';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { LoadingState } from '@/components/common/LoadingState';
import { formatGBP, formatGBPDecimal, formatPercent } from '@/lib/calculations';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PortalDistributionEntity {
  id: string;
  entity_name: string;
}

interface PortalDistributionAllocation {
  distribution_id: string;
  shareholder_name: string;
  ownership_percent: number;
  amount: number;
  paid_at: string | null;
}

interface PortalDistribution {
  id: string;
  period_label: string;
  total_rental_income: number;
  total_expenses: number;
  total_mortgage_costs: number;
  net_distributable: number;
  total_distributed: number;
  status: string;
  period_start: string;
  entity?: PortalDistributionEntity | null;
  allocations?: PortalDistributionAllocation[];
}

export default function PortalDashboard() {
  const { canViewFinancials, orgId, isShareholderUser } = useShareholderSession();
  const { properties, loansByProperty, performanceByProperty, isLoading } = useShareholderPortfolioData({
    includeFinancials: canViewFinancials,
    includeCompliance: false,
    includePhotos: false,
  });

  // Fetch recent distributions for portal
  const { data: portalDistributions } = useQuery<PortalDistribution[]>({
    queryKey: ['portal-distributions', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('distributions')
        .select(`
          *,
          entity:legal_entities!distributions_entity_id_fkey ( id, entity_name )
        `)
        .eq('org_id', orgId)
        .in('status', ['approved', 'distributed'])
        .order('period_start', { ascending: false })
        .limit(8);
      if (error) throw error;

      // Fetch allocations for each
      const distIds = (data || []).map(d => d.id);
      if (distIds.length === 0) return [];

      const { data: allocs } = await supabase
        .from('distribution_allocations')
        .select('*')
        .in('distribution_id', distIds);

      return (data || []).map((distribution) => ({
        ...distribution,
        allocations: (allocs || []).filter((allocation) => allocation.distribution_id === distribution.id),
      }));
    },
    enabled: !!orgId && isShareholderUser && canViewFinancials,
  });

  const generatePortalPdf = (dist: PortalDistribution) => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Distribution Statement', 14, 20);
    doc.setFontSize(11);
    doc.text(`Entity: ${dist.entity?.entity_name || 'Unknown'}`, 14, 32);
    doc.text(`Period: ${dist.period_label}`, 14, 39);
    doc.text(`Date: ${format(new Date(), 'dd MMM yyyy')}`, 14, 46);

    autoTable(doc, {
      startY: 56,
      head: [['Item', 'Amount']],
      body: [
        ['Rental Income', formatGBPDecimal(dist.total_rental_income)],
        ['Expenses', `(${formatGBPDecimal(dist.total_expenses)})`],
        ['Mortgage Costs', `(${formatGBPDecimal(dist.total_mortgage_costs)})`],
        ['Net Distributable', formatGBPDecimal(dist.net_distributable)],
        ['Total Distributed', formatGBPDecimal(dist.total_distributed)],
      ],
      theme: 'grid',
      headStyles: { fillColor: [30, 30, 30] },
    });

    const finalY = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || 110;
    if (dist.allocations?.length) {
      autoTable(doc, {
        startY: finalY + 10,
        head: [['Shareholder', '%', 'Amount', 'Paid']],
        body: dist.allocations.map((allocation) => [
          allocation.shareholder_name,
          `${allocation.ownership_percent.toFixed(1)}%`,
          formatGBPDecimal(allocation.amount),
          allocation.paid_at ? format(new Date(allocation.paid_at), 'dd/MM/yyyy') : 'Pending',
        ]),
        theme: 'grid',
        headStyles: { fillColor: [30, 30, 30] },
      });
    }

    doc.save(`distribution-${dist.period_label.replace(/\s/g, '-')}.pdf`);
  };

  const totalDistributed = useMemo(() => {
    return (portalDistributions || []).reduce((sum, d) => sum + (d.total_distributed || 0), 0);
  }, [portalDistributions]);

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
                          {property.property_type?.replace('_', ' ') || '-'}
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

        {/* Distributions Section */}
        {canViewFinancials && portalDistributions && portalDistributions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Banknote className="h-5 w-5" />
                Distributions
              </CardTitle>
              <CardDescription>
                Recent quarterly distributions - Total received: <span className="font-medium text-foreground">{formatGBP(totalDistributed)}</span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2 font-medium">Period</th>
                      <th className="text-left py-2 px-2 font-medium">Entity</th>
                      <th className="text-right py-2 px-2 font-medium">Net</th>
                      <th className="text-right py-2 px-2 font-medium">Distributed</th>
                      <th className="text-center py-2 px-2 font-medium">Status</th>
                      <th className="text-right py-2 px-2 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {portalDistributions.map((dist) => (
                      <tr key={dist.id} className="border-b last:border-0">
                        <td className="py-2 px-2 font-medium">{dist.period_label}</td>
                        <td className="py-2 px-2 text-muted-foreground">{dist.entity?.entity_name}</td>
                        <td className="py-2 px-2 text-right">{formatGBP(dist.net_distributable)}</td>
                        <td className="py-2 px-2 text-right text-success font-medium">{formatGBP(dist.total_distributed)}</td>
                        <td className="py-2 px-2 text-center">
                          <Badge variant={dist.status === 'distributed' ? 'default' : 'secondary'}>
                            {dist.status}
                          </Badge>
                        </td>
                        <td className="py-2 px-2 text-right">
                          <Button size="sm" variant="ghost" onClick={() => generatePortalPdf(dist)}>
                            <FileText className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

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
