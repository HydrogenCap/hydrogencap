import { format } from 'date-fns';
import {
  Home,
  Building2,
  Eye,
  Download,
  Pencil,
  Trash2,
  EllipsisVertical,
  File,
  Archive,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ValuationSummaryInline } from '@/components/documents/ValuationSummaryInline';
import { FILE_ICONS, formatBytes } from '@/components/documents/documentUtils';
import { cn } from '@/lib/utils';
import type { ManagedDocument, DocumentCategory } from '@/hooks/useDocumentManagement';
import type { LucideIcon } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────

interface DocumentListViewProps {
  currentDocuments: ManagedDocument[];
  archivedDocuments: ManagedDocument[];
  groupedByProperty: Map<string, ManagedDocument[]> | null;
  sortBy: 'date' | 'property' | 'name';
  categories: DocumentCategory[] | undefined;
  showArchived: boolean;
  onToggleArchived: () => void;
  onViewDoc: (doc: ManagedDocument) => void;
  onEditDoc: (doc: ManagedDocument) => void;
  onDeleteDoc: (doc: ManagedDocument) => void;
  onDownloadDoc: (doc: ManagedDocument) => void;
}

// ─── List Row ────────────────────────────────────────────────────

function ListRow({
  doc,
  FileIcon,
  catMeta,
  onView,
  onEdit,
  onDelete,
  onDownload,
}: {
  doc: ManagedDocument;
  FileIcon: LucideIcon;
  catMeta?: DocumentCategory;
  onView: (doc: ManagedDocument) => void;
  onEdit: (doc: ManagedDocument) => void;
  onDelete: (doc: ManagedDocument) => void;
  onDownload: (doc: ManagedDocument) => void;
}) {
  const isValuation = doc.category === 'valuations';
  return (
    <div key={doc.id}>
      <div
        className="flex items-center gap-4 p-3.5 hover:bg-muted/50 cursor-pointer transition-colors"
        onClick={() => onView(doc)}
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
                <Home className="h-3 w-3" />{doc.property.address_line_1}
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
            <Button aria-label="More options" variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <EllipsisVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onView(doc); }}>
              <Eye className="h-4 w-4 mr-2" /> View
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDownload(doc); }}>
              <Download className="h-4 w-4 mr-2" /> Download
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(doc); }}>
              <Pencil className="h-4 w-4 mr-2" /> Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(doc); }}>
              <Trash2 className="h-4 w-4 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {isValuation && <ValuationSummaryInline documentId={doc.id} compact />}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────

export function DocumentListView({
  currentDocuments,
  archivedDocuments,
  groupedByProperty,
  sortBy,
  categories,
  showArchived,
  onToggleArchived,
  onViewDoc,
  onEditDoc,
  onDeleteDoc,
  onDownloadDoc,
}: DocumentListViewProps) {
  const renderRow = (doc: ManagedDocument) => {
    const FileIcon = FILE_ICONS[doc.file_type || 'other'] || File;
    const catMeta = categories?.find(c => c.slug === doc.category);
    return (
      <ListRow
        key={doc.id}
        doc={doc}
        FileIcon={FileIcon}
        catMeta={catMeta}
        onView={onViewDoc}
        onEdit={onEditDoc}
        onDelete={onDeleteDoc}
        onDownload={onDownloadDoc}
      />
    );
  };

  return (
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
              {docs.map(renderRow)}
            </div>
          </div>
        ))
      ) : currentDocuments.length > 0 ? (
        <div className="border rounded-xl divide-y">
          {currentDocuments.map(renderRow)}
        </div>
      ) : null}

      {/* Archived (expired or superseded) documents */}
      {archivedDocuments.length > 0 && (
        <div>
          <button
            onClick={onToggleArchived}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            {showArchived ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <Archive className="h-4 w-4" />
            Archived
            <Badge variant="secondary" className="ml-1">{archivedDocuments.length}</Badge>
          </button>
          {showArchived && (
            <div className="border rounded-xl divide-y opacity-70">
              {archivedDocuments.map(renderRow)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
