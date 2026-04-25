import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Users, User, Building2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SectionCard } from '@/components/dashboard/SectionCard';
import { StatusBadge } from '@/components/dashboard/MetricValue';
import { formatGBP, formatPercent } from '@/lib/calculations';
import { usePortfolioKPIs } from '@/hooks/usePortfolioKPIs';
import { usePortfolioOwnershipV2 } from '@/hooks/useOwnershipAttributionV2';
import { usePropertiesV2 } from '@/hooks/usePropertiesV2';

const SHAREHOLDER_COLORS = [
  'hsl(174, 72%, 45%)',
  'hsl(190, 80%, 50%)',
  'hsl(200, 85%, 55%)',
  'hsl(280, 70%, 55%)',
  'hsl(320, 75%, 50%)',
  'hsl(38, 92%, 50%)',
  'hsl(142, 70%, 45%)',
  'hsl(350, 80%, 55%)',
];

export interface ShareholderEntry {
  id: string;
  name: string;
  type: string;
  equityPercent: number;
  equity: number;
  cashflow: number;
  properties: number;
  color: string;
}

export function DashboardShareholdersTab() {
  const { data: kpis } = usePortfolioKPIs();
  const { data: properties } = usePropertiesV2();
  const coreProperties = useMemo(() =>
    (properties || [])
      .filter(p => ['stabilised', 'letting'].includes(p.lifecycle_stage))
      .map(p => ({ id: p.id, address_line_1: p.address_line_1, city: p.city, entity_id: p.entity_id })),
    [properties]
  );

  const { data: ownershipV2, isLoading } = usePortfolioOwnershipV2(
    coreProperties.length > 0 ? coreProperties : undefined
  );

  // Build shareholder entries from V2 ownership data + KPI property rows
  const shareholderData: ShareholderEntry[] = useMemo(() => {
    if (!ownershipV2 || !kpis) return [];

    const propertyKPIMap = new Map(kpis.properties.map(p => [p.propertyId, p]));

    const entries = ownershipV2.portfolioOwners.map((owner, idx) => {
      let totalEquity = 0;
      let totalCashflow = 0;

      for (const op of owner.properties) {
        const kpiRow = propertyKPIMap.get(op.propertyId);
        if (kpiRow) {
          const factor = op.effectivePercent / 100;
          totalEquity += kpiRow.equity * factor;
          totalCashflow += kpiRow.annualCashflow * factor;
        }
      }

      return {
        id: owner.ownerEntityId || owner.ownerName,
        name: owner.ownerName,
        type: owner.ownerType,
        equityPercent: 0, // calculated below
        equity: totalEquity,
        cashflow: totalCashflow / 12,
        properties: owner.totalEffectiveProperties,
        color: SHAREHOLDER_COLORS[idx % SHAREHOLDER_COLORS.length],
      };
    });

    const totalEquity = entries.reduce((s, e) => s + e.equity, 0);
    for (const entry of entries) {
      entry.equityPercent = totalEquity > 0 ? (entry.equity / totalEquity) * 100 : 0;
    }

    return entries.sort((a, b) => b.equityPercent - a.equityPercent);
  }, [ownershipV2, kpis]);

  return (
    <div className="space-y-6 mt-6">
      <SectionCard
        title="Shareholder Breakdown"
        subtitle={`${shareholderData.length} beneficial owner${shareholderData.length !== 1 ? 's' : ''} across the portfolio`}
        icon={Users}
      >
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-[300px] w-full" />
            <Skeleton className="h-[200px] w-full" />
          </div>
        ) : shareholderData.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p className="font-medium text-lg">No shareholders defined</p>
            <p className="text-sm mt-2">Set up company shareholders to see the breakdown</p>
          </div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Pie Chart */}
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={shareholderData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={120}
                    dataKey="equityPercent"
                    nameKey="name"
                    paddingAngle={2}
                    label={({ name, percent }) =>
                      `${name.split(' ')[0]} ${(percent * 100).toFixed(0)}%`
                    }
                    labelLine={true}
                  >
                    {shareholderData.map((entry) => (
                      <Cell key={entry.id} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, _name, props) => [
                      `${Number(value).toFixed(1)}% equity`,
                      (props?.payload as { name?: string })?.name,
                    ]}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '0.5rem',
                      color: 'hsl(var(--foreground))',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Legend */}
            <div className="space-y-2">
              {shareholderData.map((owner) => (
                <div
                  key={owner.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/50"
                >
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: owner.color }}
                  />
                  <div className="flex items-center gap-2 text-muted-foreground">
                    {owner.type === 'individual' ? (
                      <User className="h-4 w-4" />
                    ) : (
                      <Building2 className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{owner.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {owner.properties} propert{owner.properties !== 1 ? 'ies' : 'y'}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-lg font-bold text-primary">
                      {formatPercent(owner.equityPercent, 1)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </SectionCard>

      {/* Shareholders Table */}
      {shareholderData.length > 0 && (
        <SectionCard
          title="Detailed Breakdown"
          subtitle="Financial attribution by beneficial owner"
          noPadding
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead>Owner</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Equity %</TableHead>
                  <TableHead className="text-right">Attributable Equity</TableHead>
                  <TableHead className="text-right">Monthly Cashflow</TableHead>
                  <TableHead className="text-right">Properties</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shareholderData.map((owner) => (
                  <TableRow key={owner.id} className="hover:bg-muted/20">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: owner.color }}
                        />
                        <span className="font-medium">{owner.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status="neutral">
                        {owner.type === 'individual' ? 'Individual' : 'Company'}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="text-right font-bold text-primary">
                      {formatPercent(owner.equityPercent, 1)}
                    </TableCell>
                    <TableCell className="text-right">{formatGBP(owner.equity)}</TableCell>
                    <TableCell
                      className={`text-right ${owner.cashflow >= 0 ? 'text-success' : 'text-destructive'}`}
                    >
                      {formatGBP(owner.cashflow)}
                    </TableCell>
                    <TableCell className="text-right">{owner.properties}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </SectionCard>
      )}
    </div>
  );
}
