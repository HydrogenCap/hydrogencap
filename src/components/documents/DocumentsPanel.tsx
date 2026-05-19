 import { useState } from 'react';
 import { toast } from 'sonner';
 import { format } from 'date-fns';
 import { 
   FileText, Upload, Search, Grid, List, 
   EllipsisVertical, Download, Pencil, Trash2, Eye,
   FolderOpen, File, Image, FileSpreadsheet
 } from 'lucide-react';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Badge } from '@/components/ui/badge';
 import { Card, CardContent } from '@/components/ui/card';
 import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuSeparator,
   DropdownMenuTrigger,
 } from '@/components/ui/dropdown-menu';
 import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
 } from '@/components/ui/select';
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
 import { Skeleton } from '@/components/ui/skeleton';
 import { 
   useManagedDocuments, 
   useDocumentCategories,
   useDownloadDocument,
   useDeleteManagedDocument,
   type ManagedDocument
 } from '@/hooks/useDocumentManagement';
 import { UploadDocumentDialog } from './UploadDocumentDialog';
 import { EditDocumentDialog } from './EditDocumentDialog';
 import { DocumentViewer } from './DocumentViewer';
 
interface DocumentsPanelProps {
   propertyId?: string;
   companyId?: string;
   tenantId?: string;
   tenancyId?: string;
   complianceItemId?: string;
   jobId?: string;
   entityType?: string;
   title?: string;
   compact?: boolean;
 }
 
 const FILE_ICONS: Record<string, typeof File> = {
   pdf: FileText,
   image: Image,
   doc: FileText,
   spreadsheet: FileSpreadsheet,
   other: File,
 };
 
 function formatBytes(bytes: number): string {
   if (bytes === 0) return '0 B';
   const k = 1024;
   const sizes = ['B', 'KB', 'MB', 'GB'];
   const i = Math.floor(Math.log(bytes) / Math.log(k));
   return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
 }
 
 export function DocumentsPanel({
   propertyId,
   companyId,
   tenantId,
   tenancyId,
   complianceItemId,
   jobId,
   entityType,
   title = 'Documents',
   compact = false,
 }: DocumentsPanelProps) {
   const [searchTerm, setSearchTerm] = useState('');
   const [categoryFilter, setCategoryFilter] = useState<string>('all');
   const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
   const [showUploadDialog, setShowUploadDialog] = useState(false);
   const [editingDocument, setEditingDocument] = useState<ManagedDocument | null>(null);
   const [viewingDocument, setViewingDocument] = useState<ManagedDocument | null>(null);
   const [deletingDocument, setDeletingDocument] = useState<ManagedDocument | null>(null);
 
   const { data: documents, isLoading } = useManagedDocuments({
     propertyId,
     companyId,
     tenantId,
     tenancyId,
     complianceItemId,
     jobId,
     category: categoryFilter !== 'all' ? categoryFilter : undefined,
     search: searchTerm || undefined,
   });
 
   const { data: categories } = useDocumentCategories(entityType);
   const downloadDocument = useDownloadDocument();
   const deleteDocument = useDeleteManagedDocument();
 
   const handleDelete = async () => {
     if (!deletingDocument) return;
     try {
       await deleteDocument.mutateAsync(deletingDocument.id);
       setDeletingDocument(null);
     } catch (err) {
       console.error('Failed to delete document:', err);
       toast.error(err instanceof Error ? err.message : 'Failed to delete document');
     }
   };
 
   // Group by category
   const groupedDocuments = documents?.reduce((acc, doc) => {
     const cat = doc.category || 'other';
     if (!acc[cat]) acc[cat] = [];
     acc[cat].push(doc);
     return acc;
   }, {} as Record<string, ManagedDocument[]>);
 
   if (isLoading) {
     return (
       <div className="space-y-4">
         <div className="flex items-center justify-between">
           <Skeleton className="h-6 w-32" />
           <Skeleton className="h-9 w-24" />
         </div>
         <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
           {[1, 2, 3, 4].map(i => (
             <Skeleton key={i} className="h-32" />
           ))}
         </div>
       </div>
     );
   }
 
   return (
     <div className="space-y-4">
       {/* Header */}
       <div className="flex items-center justify-between">
         <h3 className="text-lg font-semibold">{title}</h3>
         <Button onClick={() => setShowUploadDialog(true)}>
           <Upload className="h-4 w-4 mr-2" />
           Upload
         </Button>
       </div>
 
       {/* Filters */}
       {!compact && (
         <div className="flex items-center gap-3">
           <div className="relative flex-1 max-w-sm">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
             <Input
               placeholder="Search documents..."
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="pl-10"
             />
           </div>
 
           <Select value={categoryFilter} onValueChange={setCategoryFilter}>
             <SelectTrigger className="w-48">
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
 
           <div className="flex border rounded-md">
             <Button aria-label="Grid view"
               variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
               size="icon"
               className="h-9 w-9 rounded-r-none"
               onClick={() => setViewMode('grid')}
               aria-label="Grid view"
               aria-pressed={viewMode === 'grid'}
             >
               <Grid className="h-4 w-4" />
             </Button>
             <Button aria-label="List view"
               variant={viewMode === 'list' ? 'secondary' : 'ghost'}
               size="icon"
               className="h-9 w-9 rounded-l-none"
               onClick={() => setViewMode('list')}
               aria-label="List view"
               aria-pressed={viewMode === 'list'}
             >
               <List className="h-4 w-4" />
             </Button>
           </div>
         </div>
       )}
 
       {/* Documents */}
       {!documents?.length ? (
         <Card>
           <CardContent className="py-12 text-center">
             <FolderOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
             <h3 className="font-medium mb-1">No documents</h3>
             <p className="text-sm text-muted-foreground mb-4">
               Upload your first document to get started
             </p>
             <Button onClick={() => setShowUploadDialog(true)}>
               <Upload className="h-4 w-4 mr-2" />
               Upload Document
             </Button>
           </CardContent>
         </Card>
       ) : viewMode === 'grid' ? (
         <div className="space-y-6">
           {Object.entries(groupedDocuments || {}).map(([category, docs]) => (
             <div key={category}>
               <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                 <FolderOpen className="h-4 w-4" />
                 {categories?.find(c => c.slug === category)?.name || category}
                 <Badge variant="secondary" className="ml-1">{docs.length}</Badge>
               </h4>
               <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                 {docs.map(doc => {
                   const FileIcon = FILE_ICONS[doc.file_type || 'other'] || File;
                   
                   return (
                     <Card
                       key={doc.id}
                       className="group cursor-pointer hover:shadow-md transition-all relative"
                       onClick={() => setViewingDocument(doc)}
                     >
                       <CardContent className="p-3">
                         {/* Preview/Icon */}
                         <div className="aspect-[4/3] bg-muted rounded-md mb-2 flex items-center justify-center overflow-hidden">
                           {doc.file_type === 'image' ? (
                             <img
                               src={doc.file_url}
                               alt={doc.display_name || doc.original_file_name}
                               className="w-full h-full object-cover"
                             />
                           ) : (
                             <FileIcon className="h-12 w-12 text-muted-foreground/70" />
                           )}
                         </div>
 
                         {/* Info */}
                         <div className="space-y-1">
                           <p className="text-sm font-medium truncate" title={doc.display_name || doc.original_file_name}>
                             {doc.display_name || doc.original_file_name}
                           </p>
                           <div className="flex items-center justify-between text-xs text-muted-foreground">
                             <span>{formatBytes(doc.file_size_bytes || 0)}</span>
                             <span>{format(new Date(doc.created_at), 'dd MMM')}</span>
                           </div>
                         </div>
 
                         {/* Actions (visible on hover) */}
                         <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                           <DropdownMenu>
                             <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                               <Button aria-label="Ellipsis Vertical" variant="secondary" size="icon" className="h-7 w-7">
                                 <EllipsisVertical className="h-4 w-4" />
                               </Button>
                             </DropdownMenuTrigger>
                             <DropdownMenuContent align="end">
                               <DropdownMenuItem onClick={(e) => {
                                 e.stopPropagation();
                                 setViewingDocument(doc);
                               }}>
                                 <Eye className="h-4 w-4 mr-2" />
                                 View
                               </DropdownMenuItem>
                               <DropdownMenuItem onClick={(e) => {
                                 e.stopPropagation();
                                 downloadDocument.mutate(doc);
                               }}>
                                 <Download className="h-4 w-4 mr-2" />
                                 Download
                               </DropdownMenuItem>
                               <DropdownMenuItem onClick={(e) => {
                                 e.stopPropagation();
                                 setEditingDocument(doc);
                               }}>
                                 <Pencil className="h-4 w-4 mr-2" />
                                 Edit
                               </DropdownMenuItem>
                               <DropdownMenuSeparator />
                               <DropdownMenuItem
                                 className="text-destructive"
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   setDeletingDocument(doc);
                                 }}
                               >
                                 <Trash2 className="h-4 w-4 mr-2" />
                                 Delete
                               </DropdownMenuItem>
                             </DropdownMenuContent>
                           </DropdownMenu>
                         </div>
                       </CardContent>
                     </Card>
                   );
                 })}
               </div>
             </div>
           ))}
         </div>
       ) : (
         /* List View */
         <div className="border rounded-lg divide-y">
           {documents?.map(doc => {
             const FileIcon = FILE_ICONS[doc.file_type || 'other'] || File;
             
             return (
               <div
                 key={doc.id}
                 className="flex items-center gap-4 p-3 hover:bg-muted/50 cursor-pointer"
                 onClick={() => setViewingDocument(doc)}
               >
                 <div className="h-10 w-10 bg-muted rounded flex items-center justify-center shrink-0">
                   <FileIcon className="h-5 w-5 text-muted-foreground" />
                 </div>
                 
                 <div className="flex-1 min-w-0">
                   <p className="font-medium truncate">{doc.display_name || doc.original_file_name}</p>
                   <p className="text-sm text-muted-foreground">
                     {categories?.find(c => c.slug === doc.category)?.name || doc.category} • {formatBytes(doc.file_size_bytes || 0)}
                   </p>
                 </div>
 
                 <div className="text-sm text-muted-foreground shrink-0">
                   {format(new Date(doc.created_at), 'dd MMM yyyy')}
                 </div>
 
                 <DropdownMenu>
                   <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                     <Button aria-label="Ellipsis Vertical" variant="ghost" size="icon" className="h-8 w-8">
                       <EllipsisVertical className="h-4 w-4" />
                     </Button>
                   </DropdownMenuTrigger>
                   <DropdownMenuContent align="end">
                     <DropdownMenuItem onClick={(e) => {
                       e.stopPropagation();
                       setViewingDocument(doc);
                     }}>
                       <Eye className="h-4 w-4 mr-2" />
                       View
                     </DropdownMenuItem>
                     <DropdownMenuItem onClick={(e) => {
                       e.stopPropagation();
                       downloadDocument.mutate(doc);
                     }}>
                       <Download className="h-4 w-4 mr-2" />
                       Download
                     </DropdownMenuItem>
                     <DropdownMenuItem onClick={(e) => {
                       e.stopPropagation();
                       setEditingDocument(doc);
                     }}>
                       <Pencil className="h-4 w-4 mr-2" />
                       Edit
                     </DropdownMenuItem>
                     <DropdownMenuSeparator />
                     <DropdownMenuItem
                       className="text-destructive"
                       onClick={(e) => {
                         e.stopPropagation();
                         setDeletingDocument(doc);
                       }}
                     >
                       <Trash2 className="h-4 w-4 mr-2" />
                       Delete
                     </DropdownMenuItem>
                   </DropdownMenuContent>
                 </DropdownMenu>
               </div>
             );
           })}
         </div>
       )}
 
       {/* Dialogs */}
       <UploadDocumentDialog
         open={showUploadDialog}
         onOpenChange={setShowUploadDialog}
         propertyId={propertyId}
         companyId={companyId}
         tenantId={tenantId}
         tenancyId={tenancyId}
         complianceItemId={complianceItemId}
         jobId={jobId}
         entityType={entityType}
       />
 
       {editingDocument && (
         <EditDocumentDialog
           open={!!editingDocument}
           onOpenChange={() => setEditingDocument(null)}
           document={editingDocument}
         />
       )}
 
       {viewingDocument && (
         <DocumentViewer
           open={!!viewingDocument}
           onOpenChange={() => setViewingDocument(null)}
           document={viewingDocument}
           onEdit={() => {
             setEditingDocument(viewingDocument);
             setViewingDocument(null);
           }}
           onDownload={() => downloadDocument.mutate(viewingDocument)}
           onDelete={() => {
             setDeletingDocument(viewingDocument);
             setViewingDocument(null);
           }}
         />
       )}
 
       <AlertDialog open={!!deletingDocument} onOpenChange={() => setDeletingDocument(null)}>
         <AlertDialogContent>
           <AlertDialogHeader>
             <AlertDialogTitle>Delete Document</AlertDialogTitle>
             <AlertDialogDescription>
               Are you sure you want to delete "{deletingDocument?.display_name || deletingDocument?.original_file_name}"? This action can be undone.
             </AlertDialogDescription>
           </AlertDialogHeader>
           <AlertDialogFooter>
             <AlertDialogCancel>Cancel</AlertDialogCancel>
             <AlertDialogAction
               onClick={handleDelete}
               className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
             >
               {deleteDocument.isPending ? 'Deleting...' : 'Delete'}
             </AlertDialogAction>
           </AlertDialogFooter>
         </AlertDialogContent>
       </AlertDialog>
     </div>
   );
 }