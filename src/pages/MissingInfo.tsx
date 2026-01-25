import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  Search, 
  Filter, 
  Download, 
  AlertTriangle, 
  CheckCircle2, 
  Building2, 
  Copy,
  RefreshCw,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  useMissingInfo,
  exportMissingInfoCSV,
  copyMissingToClipboard,
  PropertyMissingInfo,
} from '@/hooks/useMissingInfo';
import { MissingInfoPropertyRow } from '@/components/missing-info/MissingInfoPropertyRow';

type MissingTypeFilter = 'all' | 'finance' | 'insurance';
type PriorityFilter = 'all' | 'most_missing' | 'renewal_soon';
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
    if (missingTypeFilter === 'finance') {
      result = result.filter(item => item.missingFinanceFields.length > 0);
    } else if (missingTypeFilter === 'insurance') {
      result = result.filter(item => item.missingInsuranceFields.length > 0);
    }

    // Priority filter
    if (priorityFilter === 'renewal_soon') {
      result = result.filter(item => item.renewingSoon);
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

    // Additional sort for priority (renewal soon first)
    if (priorityFilter === 'all') {
      result.sort((a, b) => {
        if (a.renewingSoon && !b.renewingSoon) return -1;
        if (!a.renewingSoon && b.renewingSoon) return 1;
        return 0;
      });
    }

    return result;
  }, [data, search, missingTypeFilter, priorityFilter, lenderFilter, insurerFilter, sortBy]);

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
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Missing Information (Portfolio)</h1>
            <p className="text-muted-foreground">
              View and fix missing Finance & Insurance data across all properties
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

        {/* Summary Chips */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-amber-500/10 border-amber-500/30">
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

          <Card className="bg-purple-500/10 border-purple-500/30">
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

          <Card className="bg-primary/10 border-primary/30">
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
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search address, postcode, area..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Missing Type */}
              <Select value={missingTypeFilter} onValueChange={v => setMissingTypeFilter(v as MissingTypeFilter)}>
                <SelectTrigger className="w-[160px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Missing Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="finance">Finance Only</SelectItem>
                  <SelectItem value="insurance">Insurance Only</SelectItem>
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
                  <SelectItem value="renewal_soon">Renewal Soon</SelectItem>
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
