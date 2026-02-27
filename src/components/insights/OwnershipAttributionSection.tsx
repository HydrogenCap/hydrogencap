import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Building2,
  User,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  TrendingUp,
  Wallet,
  PiggyBank,
  Home,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { usePortfolioAttribution, type OwnerAttribution } from '@/hooks/useOwnershipAttribution';
import { PropertyWithFinancials } from '@/hooks/usePropertiesCompat';
import { formatGBP, formatPercent, getEffectiveCosts } from '@/lib/calculations';
import { cn } from '@/lib/utils';

interface OwnershipAttributionSectionProps {
  properties: PropertyWithFinancials[];
}

const ownerTypeIcons: Record<string, React.ReactNode> = {
  INDIVIDUAL: <User className="h-4 w-4" />,
  COMPANY: <Building2 className="h-4 w-4" />,
  TRUST: <Users className="h-4 w-4" />,
  SPV: <Building2 className="h-4 w-4" />,
  Person: <User className="h-4 w-4" />,
};

const ownerTypeLabels: Record<string, string> = {
  INDIVIDUAL: 'Individual',
  COMPANY: 'Company',
  TRUST: 'Trust',
  SPV: 'SPV',
  Person: 'Individual',
};

function OwnerCard({ owner, totalPortfolioValue }: { owner: OwnerAttribution; totalPortfolioValue: number }) {
  const [isOpen, setIsOpen] = useState(false);
  
  const portfolioShare = totalPortfolioValue > 0
    ? (owner.totals.totalAttributableValue / totalPortfolioValue) * 100
    : 0;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className={cn(
        "transition-colors",
        isOpen && "ring-1 ring-primary/20"
      )}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  {ownerTypeIcons[owner.ownerType] || <User className="h-4 w-4" />}
                </div>
                <div>
                  <CardTitle className="text-base">{owner.ownerName}</CardTitle>
                  <CardDescription className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {ownerTypeLabels[owner.ownerType] || owner.ownerType}
                    </Badge>
                    <span>{owner.totals.propertyCount} properties</span>
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-lg font-bold">{formatGBP(owner.totals.totalAttributableEquity)}</div>
                  <div className="text-xs text-muted-foreground">Equity</div>
                </div>
                <Button variant="ghost" size="icon">
                  {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            {/* Summary Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <Home className="h-3 w-3" />
                  Value
                </div>
                <div className="font-semibold">{formatGBP(owner.totals.totalAttributableValue)}</div>
                <div className="text-xs text-muted-foreground">
                  {formatPercent(portfolioShare, 1)} of portfolio
                </div>
              </div>
              
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <Wallet className="h-3 w-3" />
                  Debt
                </div>
                <div className="font-semibold">{formatGBP(owner.totals.totalAttributableDebt)}</div>
                <div className="text-xs text-muted-foreground">
                  LTV: {owner.totals.totalAttributableValue > 0 
                    ? formatPercent((owner.totals.totalAttributableDebt / owner.totals.totalAttributableValue) * 100, 1)
                    : '—'}
                </div>
              </div>
              
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <PiggyBank className="h-3 w-3" />
                  Gross Rent
                </div>
                <div className="font-semibold">
                  {formatGBP(owner.totals.totalAttributableRent)}/yr
                </div>
                <div className="text-xs text-muted-foreground">
                  Yield: {owner.totals.weightedYield !== null ? formatPercent(owner.totals.weightedYield, 2) : '—'}
                </div>
              </div>
              
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <TrendingUp className="h-3 w-3" />
                  Net Annual Cashflow
                </div>
                <div className={cn(
                  "font-semibold",
                  owner.totals.totalAttributableCashflow >= 0 ? "text-success" : "text-destructive"
                )}>
                  {formatGBP(owner.totals.totalAttributableCashflow)}/yr
                </div>
                <div className="text-xs text-muted-foreground">
                  ROCE: {owner.totals.weightedROCE !== null ? formatPercent(owner.totals.weightedROCE, 2) : '—'}
                </div>
              </div>
            </div>

            {/* Property Breakdown Table */}
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Property</TableHead>
                    <TableHead className="text-right">Stake</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead className="text-right">Equity</TableHead>
                    <TableHead className="text-right">Gross Rent</TableHead>
                    <TableHead className="text-right">Net Cashflow</TableHead>
                    <TableHead className="w-8"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {owner.properties.map((prop) => (
                    <TableRow key={prop.propertyId}>
                      <TableCell>
                        <div className="font-medium truncate max-w-[200px]">{prop.propertyAddress}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {prop.pathDescription}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatPercent(prop.effectivePercent, 1)}
                      </TableCell>
                      <TableCell className="text-right">{formatGBP(prop.attributableValue)}</TableCell>
                      <TableCell className="text-right">{formatGBP(prop.attributableEquity)}</TableCell>
                      <TableCell className="text-right">
                        {formatGBP(prop.attributableRent)}
                      </TableCell>
                      <TableCell className={cn(
                        "text-right",
                        prop.attributableCashflow >= 0 ? "text-success" : "text-destructive"
                      )}>
                        {formatGBP(prop.attributableCashflow)}
                      </TableCell>
                      <TableCell>
                        <Link to={`/properties/${prop.propertyId}`}>
                          <Button variant="ghost" size="icon" className="h-6 w-6">
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export function OwnershipAttributionSection({ properties }: OwnershipAttributionSectionProps) {
  const { data: attribution, isLoading } = usePortfolioAttribution(properties);

  // Calculate total portfolio value for percentage display
  const totalPortfolioValue = properties.reduce(
    (sum, p) => sum + (p.current_value_gbp ? Number(p.current_value_gbp) : 0),
    0
  );

  // Calculate portfolio totals from properties directly for accurate gross rent and cashflow
  // Must be called before any conditional returns to satisfy hooks rules
  const portfolioTotals = useMemo(() => {
    const currentYear = new Date().getFullYear();
    let totalGrossRent = 0;
    let totalCashflow = 0;
    
    for (const p of properties) {
      const income = p.income?.find(i => i.year === currentYear);
      const annualRent = income?.annual_rent_gbp ? Number(income.annual_rent_gbp) : 0;
      totalGrossRent += annualRent;
      
      // Calculate cashflow for this property
      const loan = p.loans?.[0];
      const costs = p.costs?.find(c => c.year === currentYear);
      const currentValue = p.current_value_gbp ? Number(p.current_value_gbp) : 0;
      const mortgagePayment = loan?.mortgage_payment_gbp ? Number(loan.mortgage_payment_gbp) : 0;
      
      const effectiveCosts = getEffectiveCosts(annualRent, currentValue, costs);
      const noi = annualRent - effectiveCosts.total;
      const annualDebtService = mortgagePayment * 12;
      totalCashflow += noi - annualDebtService;
    }
    
    // Sum equity from attribution (safe to access even if null/empty)
    const totalEquity = (attribution || []).reduce(
      (sum, owner) => sum + owner.totals.totalAttributableEquity,
      0
    );
    
    return {
      equity: totalEquity,
      grossRent: totalGrossRent,
      cashflow: totalCashflow,
    };
  }, [properties, attribution]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Ownership Attribution
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  if (!attribution || attribution.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Ownership Attribution
          </CardTitle>
          <CardDescription>
            Financial attribution by ultimate beneficial owner
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium mb-1">No ownership data available</p>
            <p className="text-sm">
              Set up company shareholders on the Companies page to see attribution analysis.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Header */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Ownership Attribution
          </CardTitle>
          <CardDescription>
            Financial metrics attributed to {attribution.length} beneficial owners across {properties.length} properties
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold">{formatGBP(portfolioTotals.equity)}</div>
              <div className="text-sm text-muted-foreground">Total Attributable Equity</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold">
                {formatGBP(portfolioTotals.grossRent)}/yr
              </div>
              <div className="text-sm text-muted-foreground">Total Gross Rent</div>
            </div>
            <div className={cn(
              "text-center p-4 rounded-lg",
              portfolioTotals.cashflow >= 0 ? "bg-success/10" : "bg-destructive/10"
            )}>
              <div className={cn(
                "text-2xl font-bold",
                portfolioTotals.cashflow >= 0 ? "text-success" : "text-destructive"
              )}>
                {formatGBP(portfolioTotals.cashflow)}/yr
              </div>
              <div className="text-sm text-muted-foreground">Net Annual Cashflow</div>
            </div>
          </div>

          {/* Equity Distribution Bar */}
          <div className="mt-6">
            <div className="text-sm font-medium mb-2">Equity Distribution</div>
            <div className="flex rounded-full overflow-hidden h-4">
              {attribution.map((owner, index) => {
                const percent = portfolioTotals.equity > 0
                  ? (owner.totals.totalAttributableEquity / portfolioTotals.equity) * 100
                  : 0;
                const colors = [
                  'bg-primary',
                  'bg-blue-500',
                  'bg-green-500',
                  'bg-amber-500',
                  'bg-purple-500',
                  'bg-pink-500',
                  'bg-cyan-500',
                ];
                return (
                  <div
                    key={owner.ownerId}
                    className={cn(colors[index % colors.length], "transition-all")}
                    style={{ width: `${percent}%` }}
                    title={`${owner.ownerName}: ${formatPercent(percent, 1)}`}
                  />
                );
              })}
            </div>
            <div className="flex flex-wrap gap-3 mt-2">
              {attribution.slice(0, 6).map((owner, index) => {
                const percent = portfolioTotals.equity > 0
                  ? (owner.totals.totalAttributableEquity / portfolioTotals.equity) * 100
                  : 0;
                const colors = [
                  'bg-primary',
                  'bg-blue-500',
                  'bg-green-500',
                  'bg-amber-500',
                  'bg-purple-500',
                  'bg-pink-500',
                ];
                return (
                  <div key={owner.ownerId} className="flex items-center gap-1.5 text-xs">
                    <div className={cn("w-2 h-2 rounded-full", colors[index % colors.length])} />
                    <span className="text-muted-foreground">{owner.ownerName}</span>
                    <span className="font-medium">{formatPercent(percent, 1)}</span>
                  </div>
                );
              })}
              {attribution.length > 6 && (
                <span className="text-xs text-muted-foreground">+{attribution.length - 6} more</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Individual Owner Cards */}
      <div className="space-y-4">
        {attribution.map(owner => (
          <OwnerCard 
            key={owner.ownerId} 
            owner={owner} 
            totalPortfolioValue={totalPortfolioValue}
          />
        ))}
      </div>
    </div>
  );
}
