import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  AlertTriangle, 
  ArrowUpDown, 
  Building2, 
  ChevronRight,
  Filter,
  Search,
  TrendingDown,
  Percent,
  Zap,
  Home,
  FileWarning,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { usePortfolioRisks, RiskType, riskTypeLabels } from '@/hooks/usePortfolioRisks';

type RiskTypeFilter = 'all' | RiskType;
type SeverityFilter = 'all' | 'critical' | 'warning';
type SortField = 'severity' | 'type' | 'address';
type SortDir = 'asc' | 'desc';

const riskTypeIcons: Record<RiskType, React.ReactNode> = {
  ltv: <Percent className="h-4 w-4" />,
  epc: <Zap className="h-4 w-4" />,
  rate_expiry: <TrendingDown className="h-4 w-4" />,
  negative_cashflow: <TrendingDown className="h-4 w-4" />,
  hmo_licence: <Home className="h-4 w-4" />,
  operational_data: <FileWarning className="h-4 w-4" />,
};

export default function ActionsPage() {
  const { risks, criticalCount, warningCount, totalCount, isLoading } = usePortfolioRisks();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<RiskTypeFilter>('all');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [sortField, setSortField] = useState<SortField>('severity');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Apply filters and sorting
  const filteredRisks = useMemo(() => {
    let result = [...risks];

    // Search
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(r => 
        r.address.toLowerCase().includes(searchLower) ||
        r.message.toLowerCase().includes(searchLower)
      );
    }

    // Type filter
    if (typeFilter !== 'all') {
      result = result.filter(r => r.type === typeFilter);
    }

    // Severity filter
    if (severityFilter !== 'all') {
      result = result.filter(r => r.severity === severityFilter);
    }

    // Sorting
    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'severity') {
        cmp = a.severity === 'critical' ? -1 : b.severity === 'critical' ? 1 : 0;
      } else if (sortField === 'type') {
        cmp = riskTypeLabels[a.type].localeCompare(riskTypeLabels[b.type]);
      } else if (sortField === 'address') {
        cmp = a.address.localeCompare(b.address);
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });

    return result;
  }, [risks, search, typeFilter, severityFilter, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}
          </div>
          <Skeleton className="h-96" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Action Required</h1>
          <p className="text-muted-foreground">
            Review and resolve portfolio risks and compliance issues
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-destructive/10 border-destructive/30">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Critical</p>
                  <p className="text-3xl font-bold text-destructive">{criticalCount}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-destructive/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-warning/10 border-warning/30">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Warning</p>
                  <p className="text-3xl font-bold text-warning">{warningCount}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-warning/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-muted/50 border-border">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Issues</p>
                  <p className="text-3xl font-bold text-foreground">{totalCount}</p>
                </div>
                <Building2 className="h-8 w-8 text-muted-foreground/50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search address or issue..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              <Select value={typeFilter} onValueChange={v => setTypeFilter(v as RiskTypeFilter)}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Issue Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="ltv">LTV Risk</SelectItem>
                  <SelectItem value="epc">EPC Risk</SelectItem>
                  <SelectItem value="rate_expiry">Rate Expiry</SelectItem>
                  <SelectItem value="negative_cashflow">Negative Cashflow</SelectItem>
                  <SelectItem value="hmo_licence">HMO Licence</SelectItem>
                  <SelectItem value="operational_data">Missing Data</SelectItem>
                </SelectContent>
              </Select>

              <Select value={severityFilter} onValueChange={v => setSeverityFilter(v as SeverityFilter)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="critical">Critical Only</SelectItem>
                  <SelectItem value="warning">Warning Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Results Table */}
        {filteredRisks.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="flex flex-col items-center gap-4">
                <div className="p-4 rounded-full bg-success/10">
                  <AlertTriangle className="h-8 w-8 text-success" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">No Actions Required</h3>
                  <p className="text-sm text-muted-foreground">
                    {totalCount === 0 
                      ? 'Your portfolio is healthy with no identified risks.'
                      : 'No results match your current filters.'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => toggleSort('severity')}
                      className="h-auto p-0 font-medium hover:bg-transparent"
                    >
                      Severity
                      <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => toggleSort('type')}
                      className="h-auto p-0 font-medium hover:bg-transparent"
                    >
                      Type
                      <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => toggleSort('address')}
                      className="h-auto p-0 font-medium hover:bg-transparent"
                    >
                      Property
                      <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>Issue</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRisks.map(risk => (
                  <TableRow key={risk.id}>
                    <TableCell>
                      <Badge 
                        variant={risk.severity === 'critical' ? 'destructive' : 'outline'}
                        className={risk.severity === 'warning' ? 'border-warning text-warning bg-warning/10' : ''}
                      >
                        {risk.severity === 'critical' ? 'Critical' : 'Warning'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">
                          {riskTypeIcons[risk.type]}
                        </span>
                        <span className="font-medium">{riskTypeLabels[risk.type]}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{risk.address}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">{risk.message}</span>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/properties/${risk.propertyId}`}>
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
