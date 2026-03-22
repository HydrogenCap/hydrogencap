import React, { useState, useMemo, useDeferredValue } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Building2, Plus, Search, Filter, ExternalLink, ArrowUpDown, AlertTriangle } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { Skeleton } from '@/components/ui/skeleton';
import { useCompanies, type Company, type CompanyType, type CompanyStatus } from '@/hooks/useCompanies';
import { CreateCompanyDialog, ComplianceStatusBadge, ComplianceSummaryWidget } from '@/components/companies';
import { getComplianceStatus } from '@/lib/complianceStatus';
import { cn } from '@/lib/utils';

const COMPANY_TYPE_OPTIONS: { value: CompanyType | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All Types' },
  { value: 'SPV', label: 'SPV' },
  { value: 'HOLDCO', label: 'Holding Co' },
  { value: 'OPCO', label: 'Operating Co' },
  { value: 'OTHER', label: 'Other' },
];

const STATUS_OPTIONS: { value: CompanyStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All Statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'DORMANT', label: 'Dormant' },
  { value: 'SOLD', label: 'Sold' },
  { value: 'CLOSED', label: 'Closed' },
];

type ComplianceFilter = 'ALL' | 'accounts_overdue' | 'accounts_due_soon' | 'cs_overdue' | 'cs_due_soon' | 'all_ok';

const COMPLIANCE_FILTER_OPTIONS: { value: ComplianceFilter; label: string }[] = [
  { value: 'ALL', label: 'All Compliance' },
  { value: 'accounts_overdue', label: 'Accounts Overdue' },
  { value: 'accounts_due_soon', label: 'Accounts Due Soon' },
  { value: 'cs_overdue', label: 'CS Overdue' },
  { value: 'cs_due_soon', label: 'CS Due Soon' },
  { value: 'all_ok', label: 'All OK' },
];

const companyTypeLabels: Record<string, string> = {
  HOLDCO: 'Holding Co',
  SPV: 'SPV',
  OPCO: 'Operating Co',
  OTHER: 'Other',
};

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  DORMANT: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  SOLD: 'bg-muted text-muted-foreground',
  CLOSED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

type SortField = 'name' | 'accounts_due' | 'cs_due';
type SortDirection = 'asc' | 'desc';

export default function Companies() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: companies, isLoading, isError, error } = useCompanies();
  
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearch = useDeferredValue(searchQuery);
  const [typeFilter, setTypeFilter] = useState<CompanyType | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<CompanyStatus | 'ALL'>('ALL');
  const [complianceFilter, setComplianceFilter] = useState<ComplianceFilter>(
    (searchParams.get('compliance') as ComplianceFilter) || 'ALL'
  );
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Handle compliance filter from URL
  React.useEffect(() => {
    const urlFilter = searchParams.get('compliance') as ComplianceFilter;
    if (urlFilter && COMPLIANCE_FILTER_OPTIONS.some(o => o.value === urlFilter)) {
      setComplianceFilter(urlFilter);
    }
  }, [searchParams]);

  const handleComplianceFilterChange = (value: ComplianceFilter) => {
    setComplianceFilter(value);
    if (value === 'ALL') {
      searchParams.delete('compliance');
    } else {
      searchParams.set('compliance', value);
    }
    setSearchParams(searchParams);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Filter and sort companies
  const filteredCompanies = useMemo(() => {
    const filtered = companies?.filter((company) => {
      const matchesSearch = 
        company.legal_name.toLowerCase().includes(deferredSearch.toLowerCase()) ||
        company.trading_name?.toLowerCase().includes(deferredSearch.toLowerCase()) ||
        company.company_number?.toLowerCase().includes(deferredSearch.toLowerCase());
      
      const matchesType = typeFilter === 'ALL' || company.company_type === typeFilter;
      const matchesStatus = statusFilter === 'ALL' || company.status === statusFilter;

      // Compliance filter
      let matchesCompliance = true;
      if (complianceFilter !== 'ALL') {
        const accountsStatus = getComplianceStatus(company.accounts_due_date);
        const csStatus = getComplianceStatus(company.confirmation_statement_due_date);
        
        switch (complianceFilter) {
          case 'accounts_overdue':
            matchesCompliance = accountsStatus.status === 'overdue';
            break;
          case 'accounts_due_soon':
            matchesCompliance = accountsStatus.status === 'due_soon';
            break;
          case 'cs_overdue':
            matchesCompliance = csStatus.status === 'overdue';
            break;
          case 'cs_due_soon':
            matchesCompliance = csStatus.status === 'due_soon';
            break;
          case 'all_ok':
            matchesCompliance = 
              (accountsStatus.status === 'ok' || accountsStatus.status === 'unknown') &&
              (csStatus.status === 'ok' || csStatus.status === 'unknown');
            break;
        }
      }

      return matchesSearch && matchesType && matchesStatus && matchesCompliance;
    }) || [];

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'name':
          comparison = a.legal_name.localeCompare(b.legal_name);
          break;
        case 'accounts_due': {
          const aDate = a.accounts_due_date ? new Date(a.accounts_due_date).getTime() : Infinity;
          const bDate = b.accounts_due_date ? new Date(b.accounts_due_date).getTime() : Infinity;
          comparison = aDate - bDate;
          break;
        }
        case 'cs_due': {
          const aCsDate = a.confirmation_statement_due_date ? new Date(a.confirmation_statement_due_date).getTime() : Infinity;
          const bCsDate = b.confirmation_statement_due_date ? new Date(b.confirmation_statement_due_date).getTime() : Infinity;
          comparison = aCsDate - bCsDate;
          break;
        }
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [companies, deferredSearch, typeFilter, statusFilter, complianceFilter, sortField, sortDirection]);

  // Group by type for summary
  const typeCounts = companies?.reduce((acc, c) => {
    acc[c.company_type] = (acc[c.company_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6 p-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </AppLayout>
    );
  }

  if (isError) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-12">
          <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
          <h2 className="text-lg font-semibold">Failed to load companies</h2>
          <p className="text-muted-foreground">{error instanceof Error ? error.message : 'Unknown error'}</p>
          <Button onClick={() => window.location.reload()} className="mt-4">Retry</Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Building2 className="h-6 w-6" />
              Companies
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage your SPVs, holding companies, and corporate structure
            </p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Company
          </Button>
        </div>

        {/* Summary Cards + Compliance Widget */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryCard
              label="Total Companies"
              value={companies?.length || 0}
              onClick={() => {
                setTypeFilter('ALL');
                setStatusFilter('ALL');
              }}
              active={typeFilter === 'ALL'}
            />
            <SummaryCard
              label="SPVs"
              value={typeCounts['SPV'] || 0}
              onClick={() => setTypeFilter('SPV')}
              active={typeFilter === 'SPV'}
            />
            <SummaryCard
              label="Holding Companies"
              value={typeCounts['HOLDCO'] || 0}
              onClick={() => setTypeFilter('HOLDCO')}
              active={typeFilter === 'HOLDCO'}
            />
            <SummaryCard
              label="Operating Companies"
              value={typeCounts['OPCO'] || 0}
              onClick={() => setTypeFilter('OPCO')}
              active={typeFilter === 'OPCO'}
            />
          </div>
          <div className="lg:col-span-1">
            <ComplianceSummaryWidget
              companies={companies}
              isLoading={isLoading}
              onFilterClick={(filter) => handleComplianceFilterChange(filter)}
            />
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search companies..."
              aria-label="Search companies"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as CompanyType | 'ALL')}>
            <SelectTrigger className="w-[160px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              {COMPANY_TYPE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as CompanyStatus | 'ALL')}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={complianceFilter} onValueChange={(v) => handleComplianceFilterChange(v as ComplianceFilter)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Compliance" />
            </SelectTrigger>
            <SelectContent>
              {COMPLIANCE_FILTER_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Companies Table */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <button 
                    className="flex items-center gap-1 hover:text-foreground"
                    onClick={() => handleSort('name')}
                  >
                    Company Name
                    {sortField === 'name' && (
                      <ArrowUpDown className="h-3 w-3" />
                    )}
                  </button>
                </TableHead>
                <TableHead>Company Number</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>
                  <button 
                    className="flex items-center gap-1 hover:text-foreground"
                    onClick={() => handleSort('accounts_due')}
                  >
                    Accounts Due
                    {sortField === 'accounts_due' && (
                      <ArrowUpDown className="h-3 w-3" />
                    )}
                  </button>
                </TableHead>
                <TableHead>
                  <button 
                    className="flex items-center gap-1 hover:text-foreground"
                    onClick={() => handleSort('cs_due')}
                  >
                    CS Due
                    {sortField === 'cs_due' && (
                      <ArrowUpDown className="h-3 w-3" />
                    )}
                  </button>
                </TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  </TableRow>
                ))
              ) : filteredCompanies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    {companies?.length === 0
                      ? 'No companies yet. Add your first company to get started.'
                      : 'No companies match your filters.'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredCompanies.map((company) => (
                  <TableRow
                    key={company.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/companies/${company.id}`)}
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium">{company.legal_name}</p>
                        {company.trading_name && company.trading_name !== company.legal_name && (
                          <p className="text-xs text-muted-foreground">
                            t/a {company.trading_name}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {company.company_number ? (
                        <a
                          href={`https://find-and-update.company-information.service.gov.uk/company/${company.company_number}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {company.company_number}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {companyTypeLabels[company.company_type]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn('text-xs', statusColors[company.status])}>
                        {company.status}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <ComplianceStatusBadge 
                        dueDate={company.accounts_due_date} 
                        compact 
                      />
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <ComplianceStatusBadge 
                        dueDate={company.confirmation_statement_due_date} 
                        compact 
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/companies/${company.id}`);
                        }}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Results Count */}
        {!isLoading && filteredCompanies.length > 0 && (
          <p className="text-sm text-muted-foreground text-center">
            Showing {filteredCompanies.length} of {companies?.length} companies
          </p>
        )}
      </div>

      <CreateCompanyDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={(companyId) => navigate(`/companies/${companyId}`)}
      />
    </AppLayout>
  );
}

interface SummaryCardProps {
  label: string;
  value: number;
  onClick: () => void;
  active?: boolean;
}

function SummaryCard({ label, value, onClick, active }: SummaryCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'p-4 rounded-lg border text-left transition-colors',
        active
          ? 'border-primary bg-primary/5'
          : 'border-border bg-card hover:border-primary/50'
      )}
    >
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </button>
  );
}
