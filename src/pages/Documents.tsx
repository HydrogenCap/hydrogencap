import { useState, useMemo } from 'react';
import { FolderOpen, FileText, Sparkles, Loader2 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common';
import { EditDocumentDialog } from '@/components/documents/EditDocumentDialog';
import { DocumentViewer } from '@/components/documents/DocumentViewer';
import { VaultUploadZone } from '@/components/documents/VaultUploadZone';
import { ValuationMasterDashboard } from '@/components/documents/ValuationMasterDashboard';
import { DocumentCategoryOverview } from '@/components/documents/DocumentCategoryOverview';
import { DocumentFilters } from '@/components/documents/DocumentFilters';
import { DocumentListView } from '@/components/documents/DocumentListView';
import { DocumentGridView } from '@/components/documents/DocumentGridView';
import { DocumentDeleteDialog } from '@/components/documents/DocumentDeleteDialog';
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
import { usePropertiesCompat as useProperties } from '@/hooks/usePropertiesCompat';
import { useCompanies } from '@/hooks/useCompanies';
import { useDocumentSorting } from '@/hooks/useDocumentSorting';
import type { GroupedSummary } from '@/components/documents/DocumentCategoryOverview';

const CATEGORY_GROUPS = [
  { label: 'Compliance', slugs: ['gas-safety', 'eicr', 'epc', 'fire-safety', 'pat-testing', 'legionella', 'hmo-licence', 'mcs-certificate', 'building-control', 'planning'] },
  { label: 'Legal', slugs: ['legal-pack', 'contracts', 'licences-permits', 'title-deeds'] },
  { label: 'Financial', slugs: ['mortgage', 'valuation', 'insurance', 'tax-accounts', 'company-accounts', 'invoices-receipts', 'invoice', 'quote'] },
  { label: 'Property', slugs: ['survey', 'floor-plans', 'photos', 'inventories'] },
  { label: 'Tenancy', slugs: ['tenancy-agreements', 'tenant-references', 'rent-statements', 'id-document'] },
  { label: 'Company', slugs: ['board-minutes', 'share-certificates', 'shareholder-agreement', 'company-formation'] },
  { label: 'General', slugs: ['correspondence', 'other'] },
];

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

  const { sortedDocuments, currentDocuments, archivedDocuments, groupedByProperty } =
    useDocumentSorting(documents, sortBy);

  const activeCategory = categories?.find(c => c.slug === filters.category);
  const hasActiveFilters = (filters.category && filters.category !== 'all') ||
    filters.propertyId || filters.companyId || filters.search;

  const handleCategoryClick = (slug: string) => {
    setFilters(prev => ({ ...prev, category: prev.category === slug ? 'all' : slug }));
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
      toast({ title: 'AI processing complete', description: parts.length > 0 ? `${parts.join(', ')}.` : 'All documents are already organised.' });
      invalidateVault();
    } catch (err) {
      console.error('Categorise error:', err);
      toast({ title: 'Categorisation failed', description: 'Something went wrong. Please try again.', variant: 'destructive' });
    } finally {
      setIsCategorising(false);
    }
  };

  const groupedSummaries: GroupedSummary[] = useMemo(() => {
    if (!summaryData) return [];
    return CATEGORY_GROUPS
      .map(g => ({ label: g.label, categories: g.slugs.map(s => summaryData.summaries.find(x => x.slug === s)).filter(Boolean) as typeof summaryData.summaries }))
      .filter(g => g.categories.length > 0);
  }, [summaryData]);

  const invalidateVault = () => {
    queryClient.invalidateQueries({ queryKey: ['document-vault'] });
    queryClient.invalidateQueries({ queryKey: ['document-vault-summaries'] });
  };

  if (summariesLoading) return (
    <AppLayout>
      <div className="space-y-8">
        <div className="space-y-2"><Skeleton className="h-8 w-48" /><Skeleton className="h-5 w-80" /></div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      </div>
    </AppLayout>
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Document Vault</h1>
            <p className="text-muted-foreground">
              {summaryData?.totalCount || 0} documents across {summaryData?.summaries.filter(s => s.count > 0).length || 0} categories
            </p>
          </div>
          <Button variant="outline" onClick={handleCategorise} disabled={isCategorising} className="gap-2">
            {isCategorising ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {isCategorising ? 'Categorising...' : 'AI Categorise'}
          </Button>
        </div>

        <VaultUploadZone onUploadComplete={invalidateVault} />

        {showCategoryOverview && (
          <DocumentCategoryOverview
            groupedSummaries={groupedSummaries}
            selectedCategory={filters.category}
            onCategoryClick={handleCategoryClick}
          />
        )}

        <DocumentFilters
          filters={filters}
          onFiltersChange={setFilters}
          categories={categories}
          properties={properties}
          companies={companies}
          sortBy={sortBy}
          onSortChange={setSortBy}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          hasActiveFilters={!!hasActiveFilters}
          activeCategory={activeCategory}
          documentCount={documents?.length || 0}
          onClearFilters={clearFilters}
          onShowCategoryOverview={setShowCategoryOverview}
        />

        {filters.category === 'valuations' && <ValuationMasterDashboard />}

        {/* Document List/Grid */}
        {docsLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
          </div>
        ) : !sortedDocuments.length ? (
          hasActiveFilters ? (
            <EmptyState
              icon={FolderOpen}
              title="No documents found"
              description="Try adjusting your filters or search query."
              action={{ label: 'Clear Filters', onClick: clearFilters }}
            />
          ) : (
            <EmptyState
              icon={FileText}
              title="No documents uploaded"
              description="Upload certificates, tenancy agreements, or financial documents. Our AI will classify and extract key details."
            />
          )
        ) : viewMode === 'list' ? (
          <DocumentListView
            currentDocuments={currentDocuments}
            archivedDocuments={archivedDocuments}
            groupedByProperty={groupedByProperty}
            sortBy={sortBy}
            categories={categories}
            showArchived={showArchived}
            onToggleArchived={() => setShowArchived(!showArchived)}
            onViewDoc={setViewingDoc}
            onEditDoc={setEditingDoc}
            onDeleteDoc={setDeletingDoc}
            onDownloadDoc={(doc) => downloadDoc.mutate(doc)}
          />
        ) : (
          <DocumentGridView
            currentDocuments={currentDocuments}
            archivedDocuments={archivedDocuments}
            showArchived={showArchived}
            onToggleArchived={() => setShowArchived(!showArchived)}
            onViewDoc={setViewingDoc}
            onEditDoc={setEditingDoc}
            onDeleteDoc={setDeletingDoc}
            onDownloadDoc={(doc) => downloadDoc.mutate(doc)}
          />
        )}
      </div>

      {editingDoc && (
        <EditDocumentDialog open={!!editingDoc} onOpenChange={() => setEditingDoc(null)} document={editingDoc} />
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
      <DocumentDeleteDialog
        document={deletingDoc}
        isOpen={!!deletingDoc}
        onClose={() => setDeletingDoc(null)}
        onConfirm={handleDelete}
        isDeleting={deleteDoc.isPending}
      />
    </AppLayout>
  );
}
