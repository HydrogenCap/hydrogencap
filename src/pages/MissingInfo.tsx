import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  Search, 
  Filter, 
  Download, 
  AlertTriangle, 
  CheckCircle2, 
  Building2, 
  RefreshCw,
  Clock,
  FileText,
  PieChart,
  TrendingDown,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useMissingInfo,
  exportMissingInfoCSV,
} from '@/hooks/useMissingInfo';
import { MissingInfoPropertyRow } from '@/components/missing-info/MissingInfoPropertyRow';

type MissingTypeFilter = 'all' | 'property' | 'income' | 'finance' | 'insurance' | 'passport' | 'critical';
type PriorityFilter = 'all' | 'most_missing' | 'renewal_soon' | 'hmo_expiring';
type SortOption = 'most_missing' | 'postcode' | 'updated';

export default function MissingInfoPage() {
  const { data, stats, lenders, insurers, isLoading } = useMissingInfo();

  // Filters
  const [search, setSearch] = useState('');
  const [missingTypeFilter, setMissingTypeFilter] = useState<MissingTypeFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [lenderFilter, setLenderFilter] = useState<string>('all');
  const [insurerFilter, setInsurerFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('most_missing');

  // Apply filters and sort
  const filteredData = useMemo(() => {
    let result = [...data];

    // Only show properties with missing info
    result = result.filter(item => item.totalMissing > 0);

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(item =>
        item.property.address_line.toLowerCase().includes(searchLower) ||
        item.property.postcode?.toLowerCase().includes(searchLower) ||
        item.property.area_name?.toLowerCase().includes(searchLower)
      );
    }

    // Missing type filter
    if (missingTypeFilter === 'property') {
      result = result.filter(item => item.missingPropertyCoreFields.length > 0);
    } else if (missingTypeFilter === 'income') {
      result = result.filter(item => item.missingIncomeFields.length > 0);
    } else if (missingTypeFilter === 'finance') {
      result = result.filter(item => item.missingFinanceFields.length > 0);
    } else if (missingTypeFilter === 'insurance') {
      result = result.filter(item => item.missingInsuranceFields.length > 0);
    } else if (missingTypeFilter === 'passport') {
      result = result.filter(item => item.missingPassportFields.length > 0);
    } else if (missingTypeFilter === 'critical') {
      result = result.filter(item => item.missingCriticalPassportFields.length > 0);
    }

    // Priority filter
    if (priorityFilter === 'renewal_soon') {
      result = result.filter(item => item.renewingSoon);
    } else if (priorityFilter === 'hmo_expiring') {
      result = result.filter(item => item.hmoLicenceExpiringSoon);
    }

    // Lender filter
    if (lenderFilter !== 'all') {
      result = result.filter(item => item.property.loans?.[0]?.lender === lenderFilter);
    }

    // Insurer filter
    if (insurerFilter !== 'all') {
      result = result.filter(item => item.insurance?.insurer_name === insurerFilter);
    }

    // Sort
    if (sortBy === 'most_missing') {
      result.sort((a, b) => b.totalMissing - a.totalMissing);
    } else if (sortBy === 'postcode') {
      result.sort((a, b) => (a.property.postcode || '').localeCompare(b.property.postcode || ''));
    } else if (sortBy === 'updated') {
      result.sort((a, b) => 
        new Date(b.property.updated_at).getTime() - new Date(a.property.updated_at).getTime()
      );
    }

    // Additional sort for priority (critical & renewal soon first)
    if (priorityFilter === 'all') {
      result.sort((a, b) => {
        // Critical passport fields first
        if (a.missingCriticalPassportFields.length > 0 && b.missingCriticalPassportFields.length === 0) return -1;
        if (a.missingCriticalPassportFields.length === 0 && b.missingCriticalPassportFields.length > 0) return 1;
        // Then renewal soon
        if (a.renewingSoon && !b.renewingSoon) return -1;
        if (!a.renewingSoon && b.renewingSoon) return 1;
        // Then HMO expiring
        if (a.hmoLicenceExpiringSoon && !b.hmoLicenceExpiringSoon) return -1;
        if (!a.hmoLicenceExpiringSoon && b.hmoLicenceExpiringSoon) return 1;
        return 0;
      });
    }

    return result;
  }, [data, search, missingTypeFilter, priorityFilter, lenderFilter, insurerFilter, sortBy]);

  // Portfolio-wide completeness stats
  const completenessStats = useMemo(() => {
    if (data.length === 0) return { average: 100, below50: 0, below75: 0, complete: 0 };
    
    const totalPercent = data.reduce((sum, d) => sum + d.completenessPercent, 0);
    const average = Math.round(totalPercent / data.length);
    const below50 = data.filter(d => d.completenessPercent < 50).length;
    const below75 = data.filter(d => d.completenessPercent >= 50 && d.completenessPercent < 75).length;
    const complete = data.filter(d => d.completenessPercent === 100).length;
    
    return { average, below50, below75, complete };
  }, [data]);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20" />)}
          </div>
          <Skeleton className="h-96" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Missing Information (Portfolio)</h1>
            <p className="text-muted-foreground">
              View and fix missing Finance, Insurance & Passport data across all properties
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => exportMissingInfoCSV(filteredData)}
            disabled={filteredData.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        {/* Portfolio Completeness Summary */}
        <Card className="border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <PieChart className="h-5 w-5 text-primary" />
              Portfolio Data Completeness
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2">
              {/* Average Completeness */}
              <div className="space-y-3">
                <div className="flex items-end justify-between">
                  <span className="text-sm text-muted-foreground">Average Completeness</span>
                  <span className={`text-3xl font-bold ${
                    completenessStats.average >= 90 
                      ? 'text-success' 
                      : completenessStats.average >= 75 
                        ? 'text-foreground' 
                        : completenessStats.average >= 50 
                          ? 'text-amber-600' 
                          : 'text-destructive'
                  }`}>
                    {completenessStats.average}%
                  </span>
                </div>
                <Progress value={completenessStats.average} className="h-3" />
              </div>

              {/* Breakdown Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 rounded-lg bg-success/10 border border-success/20">
                  <p className="text-2xl font-bold text-success">{completenessStats.complete}</p>
                  <p className="text-xs text-muted-foreground">100% Complete</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <p className="text-2xl font-bold text-amber-600">{completenessStats.below75}</p>
                  <p className="text-xs text-muted-foreground">50-75%</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <div className="flex items-center justify-center gap-1">
                    <TrendingDown className="h-4 w-4 text-destructive" />
                    <p className="text-2xl font-bold text-destructive">{completenessStats.below50}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">Below 50%</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Chips */}
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          <Card
            className={`cursor-pointer transition-all hover:shadow-md bg-green-500/10 border-green-500/30 ${missingTypeFilter === 'property' ? 'ring-2 ring-green-500' : ''}`}
            onClick={() => setMissingTypeFilter(missingTypeFilter === 'property' ? 'all' : 'property')}
          >
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Property Details</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {stats.propertiesWithPropertyCoreMissing}
                  </p>
                  <p className="text-xs text-muted-foreground">properties</p>
                </div>
                <Building2 className="h-8 w-8 text-green-500/50" />
              </div>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-all hover:shadow-md bg-orange-500/10 border-orange-500/30 ${missingTypeFilter === 'income' ? 'ring-2 ring-orange-500' : ''}`}
            onClick={() => setMissingTypeFilter(missingTypeFilter === 'income' ? 'all' : 'income')}
          >
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Income Missing</p>
                  <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                    {stats.propertiesWithIncomeMissing}
                  </p>
                  <p className="text-xs text-muted-foreground">properties</p>
                </div>
                <TrendingDown className="h-8 w-8 text-orange-500/50" />
              </div>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-all hover:shadow-md bg-amber-500/10 border-amber-500/30 ${missingTypeFilter === 'finance' ? 'ring-2 ring-amber-500' : ''}`}
            onClick={() => setMissingTypeFilter(missingTypeFilter === 'finance' ? 'all' : 'finance')}
          >
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Finance Missing</p>
                  <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                    {stats.propertiesWithFinanceMissing}
                  </p>
                  <p className="text-xs text-muted-foreground">properties</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-amber-500/50" />
              </div>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-all hover:shadow-md bg-purple-500/10 border-purple-500/30 ${missingTypeFilter === 'insurance' ? 'ring-2 ring-purple-500' : ''}`}
            onClick={() => setMissingTypeFilter(missingTypeFilter === 'insurance' ? 'all' : 'insurance')}
          >
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Insurance Missing</p>
                  <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {stats.propertiesWithInsuranceMissing}
                  </p>
                  <p className="text-xs text-muted-foreground">properties</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-purple-500/50" />
              </div>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-all hover:shadow-md bg-blue-500/10 border-blue-500/30 ${missingTypeFilter === 'passport' ? 'ring-2 ring-blue-500' : ''}`}
            onClick={() => setMissingTypeFilter(missingTypeFilter === 'passport' ? 'all' : 'passport')}
          >
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Passport Missing</p>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {stats.propertiesWithPassportMissing}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {stats.propertiesWithCriticalPassportMissing > 0 && (
                      <span className="text-red-500">{stats.propertiesWithCriticalPassportMissing} critical</span>
                    )}
                    {stats.propertiesWithCriticalPassportMissing === 0 && 'properties'}
                  </p>
                </div>
                <FileText className="h-8 w-8 text-blue-500/50" />
              </div>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-all hover:shadow-md bg-primary/10 border-primary/30 ${missingTypeFilter === 'all' ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setMissingTypeFilter('all')}
          >
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Missing Fields</p>
                  <p className="text-2xl font-bold text-primary">
                    {stats.totalMissingFields}
                  </p>
                  <p className="text-xs text-muted-foreground">across portfolio</p>
                </div>
                <RefreshCw className="h-8 w-8 text-primary/50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-col lg:flex-row gap-4 flex-wrap">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search address, postcode, area..."
                  aria-label="Search missing info"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Missing Type */}
              <Select value={missingTypeFilter} onValueChange={v => setMissingTypeFilter(v as MissingTypeFilter)}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Missing Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="property">Property Details</SelectItem>
                  <SelectItem value="income">Income Only</SelectItem>
                  <SelectItem value="finance">Finance Only</SelectItem>
                  <SelectItem value="insurance">Insurance Only</SelectItem>
                  <SelectItem value="passport">Passport Only</SelectItem>
                  <SelectItem value="critical">Critical Only</SelectItem>
                </SelectContent>
              </Select>

              {/* Priority */}
              <Select value={priorityFilter} onValueChange={v => setPriorityFilter(v as PriorityFilter)}>
                <SelectTrigger className="w-[180px]">
                  <Clock className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="most_missing">Most Missing</SelectItem>
                  <SelectItem value="renewal_soon">Insurance Renewal Soon</SelectItem>
                  <SelectItem value="hmo_expiring">HMO Licence Expiring</SelectItem>
                </SelectContent>
              </Select>

              {/* Lender */}
              {lenders.length > 0 && (
                <Select value={lenderFilter} onValueChange={setLenderFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Lender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Lenders</SelectItem>
                    {lenders.map(l => (
                      <SelectItem key={l} value={l}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Insurer */}
              {insurers.length > 0 && (
                <Select value={insurerFilter} onValueChange={setInsurerFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Insurer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Insurers</SelectItem>
                    {insurers.map(i => (
                      <SelectItem key={i} value={i}>{i}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Sort */}
              <Select value={sortBy} onValueChange={v => setSortBy(v as SortOption)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="most_missing">Most Missing Fields</SelectItem>
                  <SelectItem value="postcode">Postcode</SelectItem>
                  <SelectItem value="updated">Recently Updated</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Properties List */}
        {filteredData.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold">All Complete!</h3>
              <p className="text-muted-foreground">
                {data.length === 0
                  ? 'No properties with missing information found.'
                  : 'All properties matching your filters have complete information.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Showing {filteredData.length} {filteredData.length === 1 ? 'property' : 'properties'} with missing information
            </p>
            {filteredData.map(item => (
              <MissingInfoPropertyRow key={item.property.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
