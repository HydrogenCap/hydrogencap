import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import {
  FolderOpen,
  Search,
  Upload,
  Grid,
  List,
  X,
  Download,
  Pencil,
  Trash2,
  Eye,
  MoreVertical,
  File,
  FileText,
  Image,
  FileSpreadsheet,
  Building2,
  Home,
  Clock,
  AlertTriangle,
  Sparkles,
  Loader2,
  ArrowUpDown,
  Archive,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { EditDocumentDialog } from '@/components/documents/EditDocumentDialog';
import { DocumentViewer } from '@/components/documents/DocumentViewer';
import { VaultUploadZone } from '@/components/documents/VaultUploadZone';
import { ValuationSummaryInline } from '@/components/documents/ValuationSummaryInline';
import { ValuationMasterDashboard } from '@/components/documents/ValuationMasterDashboard';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import {
  useDocumentCategories,
  useDownloadDocument,
  useDeleteManagedDocument,
  type ManagedDocument,
} from '@/hooks/useDocumentManagement';
import {
  useDocumentCategorySummaries,
  useVaultDocuments,
  type VaultFilters,
} from '@/hooks/useDocumentVault';
import { useProperties } from '@/hooks/useProperties';
import { useCompanies } from '@/hooks/useCompanies';
import { cn } from '@/lib/utils';

// ─── Constants ───────────────────────────────────────────────────

const FILE_ICONS: Record<string, typeof File> = {
  pdf: FileText,
  image: Image,
  doc: FileText,
  spreadsheet: FileSpreadsheet,
  other: File,
};

const CATEGORY_COLOR_MAP: Record<string, string> = {
  purple: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  blue: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  green: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  amber: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  slate: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  gray: 'bg-muted text-muted-foreground border-border',
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

const CATEGORY_GROUPS = [
  { label: 'Compliance', slugs: ['gas-safety', 'eicr', 'epc', 'fire-safety', 'pat-testing', 'legionella', 'hmo-licence', 'mcs-certificate', 'building-control', 'planning'] },
  { label: 'Legal', slugs: ['legal-pack', 'contracts', 'licences-permits', 'title-deeds'] },
  { label: 'Financial', slugs: ['mortgage', 'valuation', 'insurance', 'tax-accounts', 'company-accounts', 'invoices-receipts', 'invoice', 'quote'] },
  { label: 'Property', slugs: ['survey', 'floor-plans', 'photos', 'inventories'] },
  { label: 'Tenancy', slugs: ['tenancy-agreements', 'tenant-references', 'rent-statements', 'id-document'] },
  { label: 'Company', slugs: ['board-minutes', 'share-certificates', 'shareholder-agreement', 'company-formation'] },
  { label: 'General', slugs: ['correspondence', 'other'] },
];

// ─── Component ───────────────────────────────────────────────────

export default function Documents() {
  const [filters, setFilters] = useState<VaultFilters>({ category: 'all' });
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  
  const [editingDoc, setEditingDoc] = useState<ManagedDocument | null>(null);
  const [viewingDoc, setViewingDoc] = useState<ManagedDocument | null>(null);
  const [deletingDoc, setDeletingDoc] = useState<ManagedDocument | null>(null);
  const [showCategoryOverview, setShowCategoryOverview] = useState(true);
  const [isCategorising, setIsCategorising] = useState(false);
  const [sortBy, setSortBy] = useState<'date' | 'property' | 'name'>('date');
  const [showArchived, setShowArchived] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: summaryData, isLoading: summariesLoading } = useDocumentCategorySummaries();
  const { data: documents, isLoading: docsLoading } = useVaultDocuments(filters);
  const { data: categories } = useDocumentCategories();
  const { data: properties } = useProperties();
  const { data: companies } = useCompanies();
  const downloadDoc = useDownloadDocument();
  const deleteDoc = useDeleteManagedDocument();

  const activeCategory = categories?.find(c => c.slug === filters.category);
  const hasActiveFilters = (filters.category && filters.category !== 'all') ||
    filters.propertyId || filters.companyId || filters.search;

  const handleCategoryClick = (slug: string) => {
    setFilters(prev => ({
      ...prev,
      category: prev.category === slug ? 'all' : slug,
    }));
    setShowCategoryOverview(false);
  };

  const clearFilters = () => {
    setFilters({ category: 'all' });
    setShowCategoryOverview(true);
  };

  const handleDelete = async () => {
    if (!deletingDoc) return;
    await deleteDoc.mutateAsync(deletingDoc.id);
    setDeletingDoc(null);
  };

  const handleCategorise = async () => {
    setIsCategorising(true);
    try {
      const { data, error } = await supabase.functions.invoke('categorise-documents', {
        body: { dryRun: false },
      });
      if (error) throw error;
      const parts = [];
      if (data.categorised > 0) parts.push(`${data.categorised} categorised`);
      if (data.renamed > 0) parts.push(`${data.renamed} renamed`);
      toast({
        title: 'AI processing complete',
        description: parts.length > 0
          ? `${parts.join(', ')}.`
          : 'All documents are already organised.',
      });
      queryClient.invalidateQueries({ queryKey: ['document-vault'] });
      queryClient.invalidateQueries({ queryKey: ['document-vault-summaries'] });
    } catch (err) {
      console.error('Categorise error:', err);
      toast({
        title: 'Categorisation failed',
        description: 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsCategorising(false);
    }
  };

  // Sort documents
  const sortedDocuments = useMemo(() => {
    if (!documents) return [];
    const docs = [...documents];
    switch (sortBy) {
      case 'property':
        return docs.sort((a, b) => {
          const propA = a.property?.address_line || 'zzz';
          const propB = b.property?.address_line || 'zzz';
          return propA.localeCompare(propB);
        });
      case 'name':
        return docs.sort((a, b) => {
          const nameA = a.display_name || a.original_file_name;
          const nameB = b.display_name || b.original_file_name;
          return nameA.localeCompare(nameB);
        });
      case 'date':
      default:
        return docs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
  }, [documents, sortBy]);

  // Split into current and archived documents
  // A document is archived if: (a) it's expired, OR (b) a newer document of the
  // same category+property exists (only one "live" file per type per property).
  const { currentDocuments, archivedDocuments } = useMemo(() => {
    const now = new Date();
    const current: typeof sortedDocuments = [];
    const archived: typeof sortedDocuments = [];

    // Build a map of newest document per (property_id + category) combo
    // so we can mark older duplicates as superseded
    const newestByKey = new Map<string, { date: number; id: string }>();
    for (const doc of sortedDocuments) {
      if (!doc.property_id || !doc.category) continue;
      const key = `${doc.property_id}::${doc.category}`;
      const docDate = doc.document_date
        ? new Date(doc.document_date).getTime()
        : new Date(doc.created_at).getTime();
      const existing = newestByKey.get(key);
      if (!existing || docDate > existing.date) {
        newestByKey.set(key, { date: docDate, id: doc.id });
      }
    }

    for (const doc of sortedDocuments) {
      // Rule 1: expired documents go to archive
      if (doc.expiry_date && new Date(doc.expiry_date) < now) {
        archived.push(doc);
        continue;
      }
      // Rule 2: if there's a newer doc of the same category for the same property,
      // this one is superseded → archive
      if (doc.property_id && doc.category) {
        const key = `${doc.property_id}::${doc.category}`;
        const newest = newestByKey.get(key);
        if (newest && newest.id !== doc.id) {
          archived.push(doc);
          continue;
        }
      }
      current.push(doc);
    }
    return { currentDocuments: current, archivedDocuments: archived };
  }, [sortedDocuments]);

  // Group by property when sorting by property
  const groupedByProperty = useMemo(() => {
    if (sortBy !== 'property' || !currentDocuments.length) return null;
    const groups = new Map<string, typeof currentDocuments>();
    for (const doc of currentDocuments) {
      const key = doc.property?.address_line || 'Unassigned';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(doc);
    }
    return groups;
  }, [sortBy, currentDocuments]);

  const renderListRow = (doc: any, FileIcon: any, catMeta: any) => {
    const isValuation = doc.category === 'valuations';
    return (
      <div key={doc.id}>
        <div
          className="flex items-center gap-4 p-3.5 hover:bg-muted/50 cursor-pointer transition-colors"
          onClick={() => setViewingDoc(doc as ManagedDocument)}
        >
          <div className="h-10 w-10 bg-muted rounded-lg flex items-center justify-center shrink-0">
            <FileIcon className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{doc.display_name || doc.original_file_name}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
              {catMeta && (
                <Badge variant="outline" className="text-[10px] h-5">{catMeta.name}</Badge>
              )}
              {doc.property && (
                <span className="flex items-center gap-1">
                  <Home className="h-3 w-3" />{doc.property.address_line}
                </span>
              )}
              {doc.company && (
                <span className="flex items-center gap-1">
                  <Building2 className="h-3 w-3" />{doc.company.legal_name}
                </span>
              )}
              <span>{formatBytes(doc.file_size_bytes || 0)}</span>
            </div>
          </div>
          <div className="text-right shrink-0 hidden sm:block">
            <p className="text-sm text-muted-foreground">{format(new Date(doc.created_at), 'dd MMM yyyy')}</p>
            {doc.expiry_date && (
              <p className={cn(
                'text-xs',
                new Date(doc.expiry_date) < new Date() ? 'text-destructive' :
                new Date(doc.expiry_date) < new Date(Date.now() + 30 * 86400000) ? 'text-amber-500' : 'text-muted-foreground'
              )}>
                Exp: {format(new Date(doc.expiry_date), 'dd MMM yyyy')}
              </p>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setViewingDoc(doc as ManagedDocument); }}>
                <Eye className="h-4 w-4 mr-2" /> View
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); downloadDoc.mutate(doc as ManagedDocument); }}>
                <Download className="h-4 w-4 mr-2" /> Download
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditingDoc(doc as ManagedDocument); }}>
                <Pencil className="h-4 w-4 mr-2" /> Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); setDeletingDoc(doc as ManagedDocument); }}>
                <Trash2 className="h-4 w-4 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {isValuation && <ValuationSummaryInline documentId={doc.id} compact />}
      </div>
    );
  };

  const groupedSummaries = useMemo(() => {
    if (!summaryData) return [];
    return CATEGORY_GROUPS.map(group => ({
      label: group.label,
      categories: group.slugs
        .map(slug => summaryData.summaries.find(s => s.slug === slug))
        .filter(Boolean) as typeof summaryData.summaries,
    })).filter(g => g.categories.length > 0);
  }, [summaryData]);

  if (summariesLoading) {
    return (
      <AppLayout>
        <div className="space-y-8">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-5 w-80" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">
              Document Vault
            </h1>
            <p className="text-muted-foreground">
              {summaryData?.totalCount || 0} documents across {summaryData?.summaries.filter(s => s.count > 0).length || 0} categories
            </p>
          </div>
          <Button
            variant="outline"
            onClick={handleCategorise}
            disabled={isCategorising}
            className="gap-2"
          >
            {isCategorising ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {isCategorising ? 'Categorising...' : 'AI Categorise'}
          </Button>
        </div>

        {/* Always-visible drag & drop upload zone */}
        <VaultUploadZone onUploadComplete={() => {
          queryClient.invalidateQueries({ queryKey: ['document-vault'] });
          queryClient.invalidateQueries({ queryKey: ['document-vault-summaries'] });
        }} />

        {/* Category Overview */}
        {showCategoryOverview && (
          <div className="space-y-5">
            {groupedSummaries.map(group => (
              <div key={group.label}>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">
                  {group.label}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {group.categories.map(cat => {
                    const colorClass = CATEGORY_COLOR_MAP[cat.color || 'gray'] || CATEGORY_COLOR_MAP.gray;
                    const isSelected = filters.category === cat.slug;

                    return (
                      <Card
                        key={cat.slug}
                        className={cn(
                          'cursor-pointer transition-all hover:shadow-md border-2',
                          isSelected ? 'border-primary shadow-md' : 'border-transparent hover:border-border',
                        )}
                        onClick={() => handleCategoryClick(cat.slug)}
                      >
                        <CardContent className="p-3.5">
                          <div className="flex items-start justify-between mb-2">
                            <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center text-sm border', colorClass)}>
                              <FolderOpen className="h-4 w-4" />
                            </div>
                            {cat.count > 0 && (
                              <span className="text-lg font-bold">{cat.count}</span>
                            )}
                          </div>
                          <p className="text-sm font-medium leading-tight">{cat.name}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            {cat.recentCount > 0 && (
                              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                <Clock className="h-2.5 w-2.5" />
                                {cat.recentCount} new
                              </span>
                            )}
                            {cat.expiringCount > 0 && (
                              <span className="text-[10px] text-amber-500 flex items-center gap-0.5">
                                <AlertTriangle className="h-2.5 w-2.5" />
                                {cat.expiringCount} expiring
                              </span>
                            )}
                            {cat.count === 0 && (
                              <span className="text-[10px] text-muted-foreground">No documents</span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search documents..."
              value={filters.search || ''}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value || undefined }))}
              className="pl-10 h-10"
            />
          </div>

          <Select
            value={filters.category || 'all'}
            onValueChange={(v) => {
              setFilters(prev => ({ ...prev, category: v }));
              setShowCategoryOverview(v === 'all');
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
            onValueChange={(v) => setFilters(prev => ({ ...prev, propertyId: v === 'all' ? undefined : v }))}
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
            onValueChange={(v) => setFilters(prev => ({ ...prev, companyId: v === 'all' ? undefined : v }))}
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

          <Select value={sortBy} onValueChange={(v) => setSortBy(v as 'date' | 'property' | 'name')}>
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
              onClick={() => setViewMode('grid')}
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-full w-10 rounded-none"
              onClick={() => setViewMode('list')}
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
                <button onClick={() => { setFilters(prev => ({ ...prev, category: 'all' })); setShowCategoryOverview(true); }}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {filters.propertyId && (
              <Badge variant="secondary" className="gap-1 pl-2">
                {properties?.find(p => p.id === filters.propertyId)?.address_line || 'Property'}
                <button onClick={() => setFilters(prev => ({ ...prev, propertyId: undefined }))}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {filters.companyId && (
              <Badge variant="secondary" className="gap-1 pl-2">
                {companies?.find(c => c.id === filters.companyId)?.legal_name || 'Company'}
                <button onClick={() => setFilters(prev => ({ ...prev, companyId: undefined }))}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs text-muted-foreground">
              Clear all
            </Button>
            <span className="text-sm text-muted-foreground ml-auto">
              {documents?.length || 0} document{(documents?.length || 0) !== 1 ? 's' : ''}
            </span>
          </div>
        )}
        {/* Valuation Master Dashboard */}
        {filters.category === 'valuations' && <ValuationMasterDashboard />}

        {/* Document List/Grid */}
        {docsLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
          </div>
        ) : !sortedDocuments.length ? (
          <Card>
            <CardContent className="py-16 text-center">
              <FolderOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
              <h3 className="font-medium mb-1">No documents found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {hasActiveFilters
                  ? 'Try adjusting your filters or search query.'
                  : 'Upload your first document to get started.'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Drag & drop files into the upload zone above to get started.
              </p>
            </CardContent>
          </Card>
        ) : viewMode === 'list' ? (
          <div className="space-y-4">
            {/* Current documents */}
            {sortBy === 'property' && groupedByProperty ? (
              Array.from(groupedByProperty.entries()).map(([propertyName, docs]) => (
                <div key={propertyName}>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                    <Home className="h-4 w-4" />
                    {propertyName}
                    <Badge variant="secondary" className="ml-1">{docs.length}</Badge>
                  </h4>
                  <div className="border rounded-xl divide-y">
                    {docs.map(doc => {
                      const FileIcon = FILE_ICONS[doc.file_type || 'other'] || File;
                      const catMeta = categories?.find(c => c.slug === doc.category);
                      return renderListRow(doc, FileIcon, catMeta);
                    })}
                  </div>
                </div>
              ))
            ) : currentDocuments.length > 0 ? (
              <div className="border rounded-xl divide-y">
                {currentDocuments.map(doc => {
                  const FileIcon = FILE_ICONS[doc.file_type || 'other'] || File;
                  const catMeta = categories?.find(c => c.slug === doc.category);
                  return renderListRow(doc, FileIcon, catMeta);
                })}
              </div>
            ) : null}

            {/* Archived (expired or superseded) documents */}
            {archivedDocuments.length > 0 && (
              <div>
                <button
                  onClick={() => setShowArchived(!showArchived)}
                  className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-2"
                >
                  {showArchived ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <Archive className="h-4 w-4" />
                  Archived
                  <Badge variant="secondary" className="ml-1">{archivedDocuments.length}</Badge>
                </button>
                {showArchived && (
                  <div className="border rounded-xl divide-y opacity-70">
                    {archivedDocuments.map(doc => {
                      const FileIcon = FILE_ICONS[doc.file_type || 'other'] || File;
                      const catMeta = categories?.find(c => c.slug === doc.category);
                      return renderListRow(doc, FileIcon, catMeta);
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {currentDocuments.map(doc => {
                const FileIcon = FILE_ICONS[doc.file_type || 'other'] || File;

                return (
                  <Card
                    key={doc.id}
                    className="group cursor-pointer hover:shadow-md transition-all relative"
                    onClick={() => setViewingDoc(doc as ManagedDocument)}
                  >
                    <CardContent className="p-3">
                      <div className="aspect-[4/3] bg-muted rounded-md mb-2 flex items-center justify-center overflow-hidden">
                        {doc.file_type === 'image' ? (
                          <img
                            src={doc.file_url}
                            alt={doc.display_name || doc.original_file_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <FileIcon className="h-12 w-12 text-muted-foreground/40" />
                        )}
                      </div>
                      <p className="text-sm font-medium truncate" title={doc.display_name || doc.original_file_name}>
                        {doc.display_name || doc.original_file_name}
                      </p>
                      <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                        <span>{formatBytes(doc.file_size_bytes || 0)}</span>
                        <span>{format(new Date(doc.created_at), 'dd MMM')}</span>
                      </div>

                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="secondary" size="icon" className="h-7 w-7">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); downloadDoc.mutate(doc as ManagedDocument); }}>
                              <Download className="h-4 w-4 mr-2" /> Download
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditingDoc(doc as ManagedDocument); }}>
                              <Pencil className="h-4 w-4 mr-2" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); setDeletingDoc(doc as ManagedDocument); }}>
                              <Trash2 className="h-4 w-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Archived grid */}
            {archivedDocuments.length > 0 && (
              <div>
                <button
                  onClick={() => setShowArchived(!showArchived)}
                  className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-2"
                >
                  {showArchived ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <Archive className="h-4 w-4" />
                  Archived
                  <Badge variant="secondary" className="ml-1">{archivedDocuments.length}</Badge>
                </button>
                {showArchived && (
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 opacity-70">
                    {archivedDocuments.map(doc => {
                      const FileIcon = FILE_ICONS[doc.file_type || 'other'] || File;
                      return (
                        <Card
                          key={doc.id}
                          className="group cursor-pointer hover:shadow-md transition-all relative"
                          onClick={() => setViewingDoc(doc as ManagedDocument)}
                        >
                          <CardContent className="p-3">
                            <div className="aspect-[4/3] bg-muted rounded-md mb-2 flex items-center justify-center overflow-hidden">
                              <FileIcon className="h-12 w-12 text-muted-foreground/40" />
                            </div>
                            <p className="text-sm font-medium truncate">{doc.display_name || doc.original_file_name}</p>
                            <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                              <span>{formatBytes(doc.file_size_bytes || 0)}</span>
                              <Badge variant="outline" className="text-[10px] h-4 text-destructive border-destructive/30">Expired</Badge>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Dialogs */}

      {editingDoc && (
        <EditDocumentDialog
          open={!!editingDoc}
          onOpenChange={() => setEditingDoc(null)}
          document={editingDoc}
        />
      )}

      {viewingDoc && (
        <DocumentViewer
          open={!!viewingDoc}
          onOpenChange={() => setViewingDoc(null)}
          document={viewingDoc}
          onEdit={() => { setEditingDoc(viewingDoc); setViewingDoc(null); }}
          onDownload={() => downloadDoc.mutate(viewingDoc)}
          onDelete={() => { setDeletingDoc(viewingDoc); setViewingDoc(null); }}
        />
      )}

      <AlertDialog open={!!deletingDoc} onOpenChange={() => setDeletingDoc(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deletingDoc?.display_name || deletingDoc?.original_file_name}&quot;? This action can be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteDoc.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
