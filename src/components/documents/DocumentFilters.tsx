import {
  Search,
  Grid,
  List,
  X,
  FolderOpen,
  Home,
  Building2,
  ArrowUpDown,
} from 'lucide-react';
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
import type { VaultFilters } from '@/hooks/useDocumentVault';
import type { DocumentCategory } from '@/hooks/useDocumentManagement';

// ─── Types ───────────────────────────────────────────────────────

interface Property {
  id: string;
  address_line: string;
}

interface Company {
  id: string;
  legal_name: string;
}

interface DocumentFiltersProps {
  filters: VaultFilters;
  onFiltersChange: (updater: (prev: VaultFilters) => VaultFilters) => void;
  categories: DocumentCategory[] | undefined;
  properties: Property[] | undefined;
  companies: Company[] | undefined;
  sortBy: 'date' | 'property' | 'name';
  onSortChange: (value: 'date' | 'property' | 'name') => void;
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
  hasActiveFilters: boolean;
  activeCategory: DocumentCategory | undefined;
  documentCount: number;
  onClearFilters: () => void;
  onShowCategoryOverview: (show: boolean) => void;
}

// ─── Component ───────────────────────────────────────────────────

export function DocumentFilters({
  filters,
  onFiltersChange,
  categories,
  properties,
  companies,
  sortBy,
  onSortChange,
  viewMode,
  onViewModeChange,
  hasActiveFilters,
  activeCategory,
  documentCount,
  onClearFilters,
  onShowCategoryOverview,
}: DocumentFiltersProps) {
  return (
    <>
      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            value={filters.search || ''}
            onChange={(e) => onFiltersChange(prev => ({ ...prev, search: e.target.value || undefined }))}
            className="pl-10 h-10"
          />
        </div>

        <Select
          value={filters.category || 'all'}
          onValueChange={(v) => {
            onFiltersChange(prev => ({ ...prev, category: v }));
            onShowCategoryOverview(v === 'all');
          }}
        >
          <SelectTrigger className="w-48 h-10">
            <FolderOpen className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories?.map(cat => (
              <SelectItem key={cat.slug} value={cat.slug}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.propertyId || 'all'}
          onValueChange={(v) => onFiltersChange(prev => ({ ...prev, propertyId: v === 'all' ? undefined : v }))}
        >
          <SelectTrigger className="w-52 h-10">
            <Home className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="All Properties" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Properties</SelectItem>
            {properties?.map(p => (
              <SelectItem key={p.id} value={p.id}>
                {p.address_line}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.companyId || 'all'}
          onValueChange={(v) => onFiltersChange(prev => ({ ...prev, companyId: v === 'all' ? undefined : v }))}
        >
          <SelectTrigger className="w-52 h-10">
            <Building2 className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="All Companies" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Companies</SelectItem>
            {companies?.map(c => (
              <SelectItem key={c.id} value={c.id}>
                {c.legal_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={(v) => onSortChange(v as 'date' | 'property' | 'name')}>
          <SelectTrigger className="w-44 h-10">
            <ArrowUpDown className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Sort by..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Sort by Date</SelectItem>
            <SelectItem value="property">Sort by Property</SelectItem>
            <SelectItem value="name">Sort by Name</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex border rounded-lg overflow-hidden h-10">
          <Button
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            size="icon"
            className="h-full w-10 rounded-none"
            onClick={() => onViewModeChange('grid')}
          >
            <Grid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="icon"
            className="h-full w-10 rounded-none"
            onClick={() => onViewModeChange('list')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Active filter pills */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          {activeCategory && (
            <Badge variant="secondary" className="gap-1 pl-2">
              {activeCategory.name}
              <button onClick={() => { onFiltersChange(prev => ({ ...prev, category: 'all' })); onShowCategoryOverview(true); }}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.propertyId && (
            <Badge variant="secondary" className="gap-1 pl-2">
              {properties?.find(p => p.id === filters.propertyId)?.address_line || 'Property'}
              <button onClick={() => onFiltersChange(prev => ({ ...prev, propertyId: undefined }))}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.companyId && (
            <Badge variant="secondary" className="gap-1 pl-2">
              {companies?.find(c => c.id === filters.companyId)?.legal_name || 'Company'}
              <button onClick={() => onFiltersChange(prev => ({ ...prev, companyId: undefined }))}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          <Button variant="ghost" size="sm" onClick={onClearFilters} className="h-7 text-xs text-muted-foreground">
            Clear all
          </Button>
          <span className="text-sm text-muted-foreground ml-auto">
            {documentCount} document{documentCount !== 1 ? 's' : ''}
          </span>
        </div>
      )}
    </>
  );
}
