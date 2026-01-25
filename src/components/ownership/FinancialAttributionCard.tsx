import React from 'react';
import { Link } from 'react-router-dom';
import { PiggyBank, TrendingUp, Wallet, Home, ExternalLink, Building2, User, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { usePropertyAttribution, PropertyFinancialAttribution } from '@/hooks/useOwnershipAttribution';
import { useProperty } from '@/hooks/useProperties';
import { formatGBP, formatPercent } from '@/lib/calculations';
import { cn } from '@/lib/utils';

interface FinancialAttributionCardProps {
  propertyId: string;
}

const ownerTypeIcons: Record<string, React.ReactNode> = {
  INDIVIDUAL: <User className="h-3 w-3" />,
  COMPANY: <Building2 className="h-3 w-3" />,
  TRUST: <Users className="h-3 w-3" />,
  SPV: <Building2 className="h-3 w-3" />,
  Person: <User className="h-3 w-3" />,
};

export function FinancialAttributionCard({ propertyId }: FinancialAttributionCardProps) {
  const { data: property, isLoading: propertyLoading } = useProperty(propertyId);
  const { data: attribution, isLoading: attributionLoading } = usePropertyAttribution(propertyId, property);

  const isLoading = propertyLoading || attributionLoading;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PiggyBank className="h-5 w-5" />
            Financial Attribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!attribution || attribution.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PiggyBank className="h-5 w-5" />
            Financial Attribution
          </CardTitle>
          <CardDescription>
            Financial metrics attributed to each beneficial owner
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <PiggyBank className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium mb-1">No ownership data available</p>
            <p className="text-sm">
              Set up legal ownership and company shareholders to see financial attribution.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate totals
  const totals = attribution.reduce(
    (acc, owner) => ({
      value: acc.value + owner.attributableValue,
      equity: acc.equity + owner.attributableEquity,
      debt: acc.debt + owner.attributableDebt,
      rent: acc.rent + owner.attributableRent,
      noi: acc.noi + owner.attributableNOI,
      cashflow: acc.cashflow + owner.attributableCashflow,
    }),
    { value: 0, equity: 0, debt: 0, rent: 0, noi: 0, cashflow: 0 }
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PiggyBank className="h-5 w-5" />
          Financial Attribution
        </CardTitle>
        <CardDescription>
          Financial metrics attributed by ownership stake to {attribution.length} beneficial owner{attribution.length !== 1 ? 's' : ''}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <Home className="h-3 w-3" />
              Total Value
            </div>
            <div className="font-semibold">{formatGBP(totals.value)}</div>
          </div>
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <Wallet className="h-3 w-3" />
              Total Equity
            </div>
            <div className="font-semibold">{formatGBP(totals.equity)}</div>
          </div>
          <div className={cn(
            "p-3 rounded-lg",
            totals.noi >= 0 ? "bg-success/10" : "bg-destructive/10"
          )}>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <TrendingUp className="h-3 w-3" />
              Total NOI
            </div>
            <div className={cn(
              "font-semibold",
              totals.noi >= 0 ? "text-success" : "text-destructive"
            )}>
              {formatGBP(totals.noi)}/yr
            </div>
          </div>
          <div className={cn(
            "p-3 rounded-lg",
            totals.cashflow >= 0 ? "bg-success/10" : "bg-destructive/10"
          )}>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <PiggyBank className="h-3 w-3" />
              Total Cashflow
            </div>
            <div className={cn(
              "font-semibold",
              totals.cashflow >= 0 ? "text-success" : "text-destructive"
            )}>
              {formatGBP(totals.cashflow)}/yr
            </div>
          </div>
        </div>

        {/* Attribution Table */}
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Owner</TableHead>
                <TableHead className="text-right">Stake</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="text-right">Equity</TableHead>
                <TableHead className="text-right">Rent</TableHead>
                <TableHead className="text-right">NOI</TableHead>
                <TableHead className="text-right">Cashflow</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attribution.map((owner) => (
                <TableRow key={owner.ownerId}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded bg-muted">
                        {ownerTypeIcons[owner.ownerType] || <User className="h-3 w-3" />}
                      </div>
                      <div>
                        <div className="font-medium text-sm">{owner.ownerName}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[180px]">
                          {owner.pathDescription}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline" className="font-medium">
                      {formatPercent(owner.effectivePercent, 1)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {formatGBP(owner.attributableValue)}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {formatGBP(owner.attributableEquity)}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {formatGBP(owner.attributableRent)}
                  </TableCell>
                  <TableCell className={cn(
                    "text-right text-sm",
                    owner.attributableNOI >= 0 ? "text-success" : "text-destructive"
                  )}>
                    {formatGBP(owner.attributableNOI)}
                  </TableCell>
                  <TableCell className={cn(
                    "text-right text-sm font-medium",
                    owner.attributableCashflow >= 0 ? "text-success" : "text-destructive"
                  )}>
                    {formatGBP(owner.attributableCashflow)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Note about calculations */}
        <p className="text-xs text-muted-foreground">
          Financial values are calculated as: Property Total × Ownership Stake %. 
          Ownership stakes are derived from legal ownership and company shareholding structures.
        </p>
      </CardContent>
    </Card>
  );
}
