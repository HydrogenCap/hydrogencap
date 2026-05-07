import { format } from 'date-fns';
import {
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
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FILE_ICONS, formatBytes } from '@/components/documents/documentUtils';
import type { ManagedDocument } from '@/hooks/useDocumentManagement';

// ─── Types ───────────────────────────────────────────────────────

interface DocumentGridViewProps {
  currentDocuments: ManagedDocument[];
  archivedDocuments: ManagedDocument[];
  showArchived: boolean;
  onToggleArchived: () => void;
  onViewDoc: (doc: ManagedDocument) => void;
  onEditDoc: (doc: ManagedDocument) => void;
  onDeleteDoc: (doc: ManagedDocument) => void;
  onDownloadDoc: (doc: ManagedDocument) => void;
}

// ─── Grid Card ───────────────────────────────────────────────────

function GridCard({
  doc,
  onView,
  onEdit,
  onDelete,
  onDownload,
}: {
  doc: ManagedDocument;
  onView: (doc: ManagedDocument) => void;
  onEdit: (doc: ManagedDocument) => void;
  onDelete: (doc: ManagedDocument) => void;
  onDownload: (doc: ManagedDocument) => void;
}) {
  const FileIcon = FILE_ICONS[doc.file_type || 'other'] || File;

  return (
    <Card
      className="group cursor-pointer hover:shadow-md transition-all relative"
      onClick={() => onView(doc)}
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
            <FileIcon className="h-12 w-12 text-muted-foreground/60" />
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
                <EllipsisVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
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
      </CardContent>
    </Card>
  );
}

// ─── Archived Grid Card ─────────────────────────────────────────

function ArchivedGridCard({
  doc,
  onView,
}: {
  doc: ManagedDocument;
  onView: (doc: ManagedDocument) => void;
}) {
  const FileIcon = FILE_ICONS[doc.file_type || 'other'] || File;

  return (
    <Card
      className="group cursor-pointer hover:shadow-md transition-all relative"
      onClick={() => onView(doc)}
    >
      <CardContent className="p-3">
        <div className="aspect-[4/3] bg-muted rounded-md mb-2 flex items-center justify-center overflow-hidden">
          <FileIcon className="h-12 w-12 text-muted-foreground/60" />
        </div>
        <p className="text-sm font-medium truncate">{doc.display_name || doc.original_file_name}</p>
        <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
          <span>{formatBytes(doc.file_size_bytes || 0)}</span>
          <Badge variant="outline" className="text-[10px] h-4 text-destructive border-destructive/30">Expired</Badge>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Component ───────────────────────────────────────────────────

export function DocumentGridView({
  currentDocuments,
  archivedDocuments,
  showArchived,
  onToggleArchived,
  onViewDoc,
  onEditDoc,
  onDeleteDoc,
  onDownloadDoc,
}: DocumentGridViewProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {currentDocuments.map(doc => (
          <GridCard
            key={doc.id}
            doc={doc}
            onView={onViewDoc}
            onEdit={onEditDoc}
            onDelete={onDeleteDoc}
            onDownload={onDownloadDoc}
          />
        ))}
      </div>

      {/* Archived grid */}
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
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 opacity-70">
              {archivedDocuments.map(doc => (
                <ArchivedGridCard
                  key={doc.id}
                  doc={doc}
                  onView={onViewDoc}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
