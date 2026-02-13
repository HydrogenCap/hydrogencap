import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Building2, 
  Home, 
  Users, 
  Filter, 
  ExternalLink, 
  Pencil,
  RefreshCw,
  X,
  GitBranch,
  List
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
import {
  useOwnershipGrid,
  getOwnerName,
  getOwnerType,
  type OwnershipGridFilters,
  type SubjectType,
  type OwnershipType,
} from '@/hooks/useOwnershipLinks';
import { useCompanies } from '@/hooks/useCompanies';
import { useProperties } from '@/hooks/useProperties';
import { formatPercent, formatDateUK } from '@/lib/calculations';
import { OwnershipFlowchart } from '@/components/ownership/OwnershipFlowchart';

export default function Ownership() {
  const [filters, setFilters] = useState<OwnershipGridFilters>({});
  const { data: links, isLoading, refetch, isRefetching } = useOwnershipGrid(filters);
  const { data: companies } = useCompanies();
  const { data: properties } = useProperties();

  const handleFilterChange = (key: keyof OwnershipGridFilters, value: string | undefined) => {
    setFilters(prev => ({
      ...prev,
      [key]: value || undefined,
      // Clear company/property filter if subject type changes
      ...(key === 'subjectType' && { companyId: undefined, propertyId: undefined }),
    }));
  };

  const clearFilters = () => {
    setFilters({});
  };

  const hasActiveFilters = Object.values(filters).some(v => v !== undefined);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Ownership</h1>
            <p className="text-muted-foreground">
              Unified view of all ownership records across companies and properties
            </p>
          </div>
        </div>

        <Tabs defaultValue="flowchart" className="space-y-4">
          <TabsList>
            <TabsTrigger value="flowchart" className="gap-2">
              <GitBranch className="h-4 w-4" />
              Structure
            </TabsTrigger>
            <TabsTrigger value="table" className="gap-2">
              <List className="h-4 w-4" />
              Table
            </TabsTrigger>
          </TabsList>

          <TabsContent value="flowchart">
            <OwnershipFlowchart />
          </TabsContent>

          <TabsContent value="table" className="space-y-6">
            {/* Filters */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-medium flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    Filters
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {hasActiveFilters && (
                      <Button variant="ghost" size="sm" onClick={clearFilters}>
                        <X className="h-4 w-4 mr-1" />
                        Clear all
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
                      <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm text-muted-foreground">Subject Type</label>
                    <Select value={filters.subjectType || 'all'} onValueChange={(v) => handleFilterChange('subjectType', v === 'all' ? undefined : v as SubjectType)}>
                      <SelectTrigger><SelectValue placeholder="All types" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All types</SelectItem>
                        <SelectItem value="COMPANY">Companies</SelectItem>
                        <SelectItem value="PROPERTY">Properties</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm text-muted-foreground">Company</label>
                    <Select value={filters.companyId || 'all'} onValueChange={(v) => handleFilterChange('companyId', v === 'all' ? undefined : v)} disabled={filters.subjectType === 'PROPERTY'}>
                      <SelectTrigger><SelectValue placeholder="All companies" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All companies</SelectItem>
                        {companies?.map((c) => (<SelectItem key={c.id} value={c.id}>{c.legal_name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm text-muted-foreground">Property</label>
                    <Select value={filters.propertyId || 'all'} onValueChange={(v) => handleFilterChange('propertyId', v === 'all' ? undefined : v)} disabled={filters.subjectType === 'COMPANY'}>
                      <SelectTrigger><SelectValue placeholder="All properties" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All properties</SelectItem>
                        {properties?.map((p) => (<SelectItem key={p.id} value={p.id}>{p.address_line}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm text-muted-foreground">Ownership Type</label>
                    <Select value={filters.ownershipType || 'all'} onValueChange={(v) => handleFilterChange('ownershipType', v === 'all' ? undefined : v as OwnershipType)}>
                      <SelectTrigger><SelectValue placeholder="All types" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All types</SelectItem>
                        <SelectItem value="SHAREHOLDING">Shareholding</SelectItem>
                        <SelectItem value="BENEFICIAL">Beneficial</SelectItem>
                        <SelectItem value="OTHER">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Results */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Ownership Records
                  {links && (
                    <Badge variant="secondary" className="ml-2">
                      {links.length} record{links.length !== 1 ? 's' : ''}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : !links || links.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No ownership records found</p>
                    {hasActiveFilters && (
                      <Button variant="ghost" size="sm" className="mt-2" onClick={clearFilters}>Clear filters</Button>
                    )}
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Subject</TableHead>
                          <TableHead>Owner</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="text-right">%</TableHead>
                          <TableHead className="text-right">Shares</TableHead>
                          <TableHead>Effective</TableHead>
                          <TableHead>Source</TableHead>
                          <TableHead>Updated</TableHead>
                          <TableHead className="w-16" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {links.map((link) => {
                          const subjectName = link.subject_type === 'COMPANY'
                            ? link.company?.legal_name || 'Unknown Company'
                            : link.property?.address_line || 'Unknown Property';
                          const subjectLink = link.subject_type === 'COMPANY'
                            ? `/companies/${link.subject_id}`
                            : `/properties/${link.subject_id}`;
                          return (
                            <TableRow key={link.id} className="group">
                              <TableCell>
                                <Link to={subjectLink} className="flex items-center gap-2 hover:underline">
                                  {link.subject_type === 'COMPANY' ? (
                                    <Building2 className="h-4 w-4 text-muted-foreground" />
                                  ) : (
                                    <Home className="h-4 w-4 text-muted-foreground" />
                                  )}
                                  <span className="font-medium truncate max-w-[200px]">{subjectName}</span>
                                  <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100" />
                                </Link>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {link.owner_party?.party_type === 'COMPANY' ? (
                                    <Building2 className="h-4 w-4 text-muted-foreground" />
                                  ) : (
                                    <Users className="h-4 w-4 text-muted-foreground" />
                                  )}
                                  <span className="truncate max-w-[150px]">{getOwnerName(link)}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">{link.ownership_type}</Badge>
                              </TableCell>
                              <TableCell className="text-right font-mono font-bold">
                                {formatPercent(Number(link.percent))}
                              </TableCell>
                              <TableCell className="text-right font-mono text-muted-foreground">
                                {link.shares ? link.shares.toLocaleString() : '—'}
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {link.effective_from ? formatDateUK(link.effective_from) : '—'}
                                {link.effective_to && ` → ${formatDateUK(link.effective_to)}`}
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="text-xs capitalize">{link.source}</Badge>
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {formatDateUK(link.updated_at)}
                              </TableCell>
                              <TableCell>
                                <Link to={subjectLink}>
                                  <Button variant="ghost" size="icon" className="h-7 w-7">
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                </Link>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
