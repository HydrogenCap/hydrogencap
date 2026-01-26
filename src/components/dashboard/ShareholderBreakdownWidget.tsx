import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Users, User, Building2, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { usePortfolioAttribution, type OwnerAttribution } from '@/hooks/useOwnershipAttribution';
import { PropertyWithFinancials } from '@/hooks/useProperties';
import { formatPercent, formatGBP } from '@/lib/calculations';
import { Button } from '@/components/ui/button';

interface ShareholderBreakdownWidgetProps {
  properties: PropertyWithFinancials[];
}

const CHART_COLORS = [
  'hsl(174, 72%, 45%)',
  'hsl(190, 80%, 50%)',
  'hsl(200, 85%, 55%)',
  'hsl(280, 70%, 55%)',
  'hsl(320, 75%, 50%)',
  'hsl(38, 92%, 50%)',
  'hsl(142, 70%, 45%)',
  'hsl(350, 80%, 55%)',
];

const ownerTypeIcons: Record<string, React.ReactNode> = {
  INDIVIDUAL: <User className="h-3 w-3" />,
  COMPANY: <Building2 className="h-3 w-3" />,
  Person: <User className="h-3 w-3" />,
};

export function ShareholderBreakdownWidget({ properties }: ShareholderBreakdownWidgetProps) {
  const { data: attribution, isLoading } = usePortfolioAttribution(properties);

  // Calculate shareholder data for pie chart
  const shareholderData = useMemo(() => {
    if (!attribution || attribution.length === 0) return [];

    // Calculate total equity for percentage
    const totalEquity = attribution.reduce(
      (sum, owner) => sum + owner.totals.totalAttributableEquity,
      0
    );

    return attribution.map((owner, index) => {
      const equityPercent = totalEquity > 0
        ? (owner.totals.totalAttributableEquity / totalEquity) * 100
        : 0;

      return {
        id: owner.ownerId,
        name: owner.ownerName,
        type: owner.ownerType,
        equityPercent,
        equity: owner.totals.totalAttributableEquity,
        properties: owner.totals.propertyCount,
        color: CHART_COLORS[index % CHART_COLORS.length],
      };
    }).sort((a, b) => b.equityPercent - a.equityPercent);
  }, [attribution]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Shareholder Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!shareholderData || shareholderData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Shareholder Breakdown
          </CardTitle>
          <CardDescription>
            Ownership split across your portfolio
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">No shareholders defined</p>
            <p className="text-sm mt-1">Set up company shareholders to see the breakdown</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Shareholder Breakdown
          </CardTitle>
          <Link to="/ownership">
            <Button variant="ghost" size="sm" className="text-xs">
              View All <ExternalLink className="h-3 w-3 ml-1" />
            </Button>
          </Link>
        </div>
        <CardDescription>
          {shareholderData.length} beneficial owner{shareholderData.length !== 1 ? 's' : ''} across the portfolio
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-4">
          {/* Pie Chart */}
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={shareholderData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  dataKey="equityPercent"
                  nameKey="name"
                  paddingAngle={2}
                >
                  {shareholderData.map((entry, index) => (
                    <Cell key={entry.id} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string, props: any) => [
                    `${value.toFixed(1)}% equity`,
                    props.payload.name
                  ]}
                  contentStyle={{
                    backgroundColor: 'hsl(222 47% 8%)',
                    border: '1px solid hsl(220 25% 16%)',
                    borderRadius: '0.5rem',
                    color: 'hsl(210 40% 98%)',
                  }}
                  labelStyle={{ color: 'hsl(210 40% 98%)' }}
                  itemStyle={{ color: 'hsl(210 40% 98%)' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend / List */}
          <div className="space-y-2 max-h-[220px] overflow-y-auto">
            {shareholderData.map((owner) => (
              <div
                key={owner.id}
                className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: owner.color }}
                />
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  {ownerTypeIcons[owner.type] || <User className="h-3 w-3" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{owner.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {owner.properties} propert{owner.properties !== 1 ? 'ies' : 'y'}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-bold text-primary">
                    {formatPercent(owner.equityPercent, 1)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatGBP(owner.equity)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
