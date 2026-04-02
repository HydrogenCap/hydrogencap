 import { useState, useCallback } from 'react';
 import { toast } from 'sonner';
 import { useDropzone } from 'react-dropzone';
 import { Upload, File, X } from 'lucide-react';
 import {
   Dialog,
   DialogContent,
   DialogHeader,
   DialogTitle,
   DialogFooter,
 } from '@/components/ui/dialog';
 import { Button } from '@/components/ui/button';
 import { LoadingButton } from '@/components/common/LoadingButton';
 import { Input } from '@/components/ui/input';
 import { Label } from '@/components/ui/label';
 import { Textarea } from '@/components/ui/textarea';
 import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
 } from '@/components/ui/select';
 import { Checkbox } from '@/components/ui/checkbox';
 import { useUploadManagedDocument, useDocumentCategories } from '@/hooks/useDocumentManagement';
 import { cn } from '@/lib/utils';
 
 interface UploadDocumentDialogProps {
   open: boolean;
   onOpenChange: (open: boolean) => void;
   propertyId?: string;
   companyId?: string;
   tenantId?: string;
   tenancyId?: string;
   complianceItemId?: string;
   jobId?: string;
   entityType?: string;
 }
 
 function formatBytes(bytes: number): string {
   if (bytes === 0) return '0 B';
   const k = 1024;
   const sizes = ['B', 'KB', 'MB', 'GB'];
   const i = Math.floor(Math.log(bytes) / Math.log(k));
   return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
 }
 
 export function UploadDocumentDialog({
   open,
   onOpenChange,
   propertyId,
   companyId,
   tenantId,
   tenancyId,
   complianceItemId,
   jobId,
   entityType,
 }: UploadDocumentDialogProps) {
   const [file, setFile] = useState<File | null>(null);
   const [formData, setFormData] = useState({
     displayName: '',
     category: '',
     description: '',
     documentDate: '',
     expiryDate: '',
     isConfidential: false,
     visibleToShareholders: false,
     visibleToTenants: false,
   });
 
   const { data: categories } = useDocumentCategories(entityType);
   const uploadDocument = useUploadManagedDocument();
 
   const onDrop = useCallback((acceptedFiles: File[]) => {
     const selected = acceptedFiles[0];
     if (selected) {
       setFile(selected);
       // Auto-fill display name from file name
       if (!formData.displayName) {
         const nameWithoutExt = selected.name.replace(/\.[^/.]+$/, '');
         setFormData(prev => ({ ...prev, displayName: nameWithoutExt }));
       }
     }
   }, [formData.displayName]);
 
   const { getRootProps, getInputProps, isDragActive } = useDropzone({
     onDrop,
     maxFiles: 1,
     accept: {
       'application/pdf': ['.pdf'],
       'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
       'application/msword': ['.doc'],
       'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
       'application/vnd.ms-excel': ['.xls'],
       'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
       'text/csv': ['.csv'],
     },
   });
 
   const handleSubmit = async (e: React.FormEvent) => {
     e.preventDefault();
     if (!file || !formData.displayName || !formData.category) return;
 
     try {
       await uploadDocument.mutateAsync({
         file,
         displayName: formData.displayName,
         category: formData.category,
         description: formData.description || undefined,
         propertyId,
         companyId,
         tenantId,
         tenancyId,
         complianceItemId,
         jobId,
         documentDate: formData.documentDate || undefined,
         expiryDate: formData.expiryDate || undefined,
         isConfidential: formData.isConfidential,
         visibleToShareholders: formData.visibleToShareholders,
         visibleToTenants: formData.visibleToTenants,
       });
       // Reset and close
       setFile(null);
       setFormData({
         displayName: '',
         category: '',
         description: '',
         documentDate: '',
         expiryDate: '',
         isConfidential: false,
         visibleToShareholders: false,
         visibleToTenants: false,
       });
       onOpenChange(false);
     } catch (err) {
       console.error('Failed to upload document:', err);
       toast.error(err instanceof Error ? err.message : 'Failed to upload document');
     }
   };
 
   return (
     <Dialog open={open} onOpenChange={onOpenChange}>
       <DialogContent className="max-w-lg">
         <form onSubmit={handleSubmit}>
           <DialogHeader>
             <DialogTitle>Upload Document</DialogTitle>
           </DialogHeader>
 
           <div className="space-y-4 py-4">
             {/* Dropzone */}
             <div
               {...getRootProps()}
               className={cn(
                 'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
                 isDragActive && 'border-primary bg-primary/5',
                 file && 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20'
               )}
             >
               <input {...getInputProps()} />
               {file ? (
                 <div className="flex items-center justify-center gap-3">
                   <File className="h-8 w-8 text-emerald-600" />
                   <div className="text-left">
                     <p className="font-medium">{file.name}</p>
                     <p className="text-sm text-muted-foreground">{formatBytes(file.size)}</p>
                   </div>
                   <Button
                     type="button"
                     variant="ghost"
                     size="icon"
                     className="ml-auto"
                     onClick={(e) => {
                       e.stopPropagation();
                       setFile(null);
                     }}
                   >
                     <X className="h-4 w-4" />
                   </Button>
                 </div>
               ) : (
                 <>
                   <Upload className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
                   <p className="font-medium">Drop file here or click to browse</p>
                   <p className="text-sm text-muted-foreground">
                     PDF, Images, Word, Excel up to 50MB
                   </p>
                 </>
               )}
             </div>
 
             {/* Display Name */}
             <div className="space-y-2">
               <Label htmlFor="displayName">Document Name *</Label>
               <Input
                 id="displayName"
                 value={formData.displayName}
                 onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                 placeholder="e.g., Gas Safety Certificate 2024"
                 required
               />
             </div>
 
             {/* Category */}
             <div className="space-y-2">
               <Label>Category *</Label>
               <Select
                 value={formData.category}
                 onValueChange={(v) => setFormData({ ...formData, category: v })}
                 required
               >
                 <SelectTrigger>
                   <SelectValue placeholder="Select category..." />
                 </SelectTrigger>
                 <SelectContent>
                   {categories?.map(cat => (
                     <SelectItem key={cat.slug} value={cat.slug}>
                       {cat.name}
                     </SelectItem>
                   ))}
                 </SelectContent>
               </Select>
             </div>
 
             {/* Description */}
             <div className="space-y-2">
               <Label htmlFor="description">Description</Label>
               <Textarea
                 id="description"
                 value={formData.description}
                 onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                 placeholder="Optional notes about this document..."
                 rows={2}
               />
             </div>
 
             {/* Dates */}
             <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                 <Label htmlFor="documentDate">Document Date</Label>
                 <Input
                   id="documentDate"
                   type="date"
                   value={formData.documentDate}
                   onChange={(e) => setFormData({ ...formData, documentDate: e.target.value })}
                 />
               </div>
               <div className="space-y-2">
                 <Label htmlFor="expiryDate">Expiry Date</Label>
                 <Input
                   id="expiryDate"
                   type="date"
                   value={formData.expiryDate}
                   onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                 />
               </div>
             </div>
 
             {/* Visibility */}
             <div className="space-y-3">
               <Label>Visibility</Label>
               <div className="space-y-2">
                 <label className="flex items-center gap-2">
                   <Checkbox
                     checked={formData.isConfidential}
                     onCheckedChange={(c) => setFormData({ ...formData, isConfidential: !!c })}
                   />
                   <span className="text-sm">Confidential (restricted access)</span>
                 </label>
                 <label className="flex items-center gap-2">
                   <Checkbox
                     checked={formData.visibleToShareholders}
                     onCheckedChange={(c) => setFormData({ ...formData, visibleToShareholders: !!c })}
                   />
                   <span className="text-sm">Visible to shareholders</span>
                 </label>
                 <label className="flex items-center gap-2">
                   <Checkbox
                     checked={formData.visibleToTenants}
                     onCheckedChange={(c) => setFormData({ ...formData, visibleToTenants: !!c })}
                   />
                   <span className="text-sm">Visible to tenants</span>
                 </label>
               </div>
             </div>
           </div>
 
           <DialogFooter>
             <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
               Cancel
             </Button>
             <LoadingButton
               type="submit"
               disabled={!file || !formData.displayName || !formData.category}
               loading={uploadDocument.isPending}
               loadingText="Uploading..."
             >
               <Upload className="h-4 w-4 mr-2" />Upload
             </LoadingButton>
           </DialogFooter>
         </form>
       </DialogContent>
     </Dialog>
   );
 }