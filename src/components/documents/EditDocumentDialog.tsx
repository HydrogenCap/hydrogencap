 import { useState, useEffect } from 'react';
 import { Loader2 } from 'lucide-react';
 import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogHeader,
   DialogTitle,
   DialogFooter,
 } from '@/components/ui/dialog';
 import { Button } from '@/components/ui/button';
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
 import { type ManagedDocument, useUpdateManagedDocument, useDocumentCategories } from '@/hooks/useDocumentManagement';
 
 interface EditDocumentDialogProps {
   open: boolean;
   onOpenChange: (open: boolean) => void;
   document: ManagedDocument;
 }
 
 export function EditDocumentDialog({ open, onOpenChange, document }: EditDocumentDialogProps) {
   const [formData, setFormData] = useState({
     displayName: document.display_name || document.original_file_name,
     category: document.category || 'other',
     description: document.description || '',
     documentDate: document.document_date || '',
     expiryDate: document.expiry_date || '',
     isConfidential: document.is_confidential || false,
     visibleToShareholders: document.visible_to_shareholders || false,
     visibleToTenants: document.visible_to_tenants || false,
   });
 
   const { data: categories } = useDocumentCategories();
   const updateDocument = useUpdateManagedDocument();
 
   // Reset form when document changes
   useEffect(() => {
     setFormData({
       displayName: document.display_name || document.original_file_name,
       category: document.category || 'other',
       description: document.description || '',
       documentDate: document.document_date || '',
       expiryDate: document.expiry_date || '',
       isConfidential: document.is_confidential || false,
       visibleToShareholders: document.visible_to_shareholders || false,
       visibleToTenants: document.visible_to_tenants || false,
     });
   }, [document]);
 
   const handleSubmit = async (e: React.FormEvent) => {
     e.preventDefault();
 
     await updateDocument.mutateAsync({
       id: document.id,
       displayName: formData.displayName,
       category: formData.category,
       description: formData.description || undefined,
       documentDate: formData.documentDate || undefined,
       expiryDate: formData.expiryDate || undefined,
       isConfidential: formData.isConfidential,
       visibleToShareholders: formData.visibleToShareholders,
       visibleToTenants: formData.visibleToTenants,
     });
 
     onOpenChange(false);
   };
 
   return (
     <Dialog open={open} onOpenChange={onOpenChange}>
       <DialogContent>
         <form onSubmit={handleSubmit}>
           <DialogHeader>
             <DialogTitle>Edit Document</DialogTitle>
             <DialogDescription>
               Update this document's name, category, or tags.
             </DialogDescription>
           </DialogHeader>
 
           <div className="space-y-4 py-4">
             {/* Display Name */}
             <div className="space-y-2">
               <Label htmlFor="editDisplayName">Document Name *</Label>
               <Input
                 id="editDisplayName"
                 value={formData.displayName}
                 onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                 required
               />
             </div>
 
             {/* Category */}
             <div className="space-y-2">
               <Label>Category *</Label>
               <Select
                 value={formData.category}
                 onValueChange={(v) => setFormData({ ...formData, category: v })}
               >
                 <SelectTrigger>
                   <SelectValue />
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
               <Label htmlFor="editDescription">Description</Label>
               <Textarea
                 id="editDescription"
                 value={formData.description}
                 onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                 rows={2}
               />
             </div>
 
             {/* Dates */}
             <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                 <Label htmlFor="editDocDate">Document Date</Label>
                 <Input
                   id="editDocDate"
                   type="date"
                   value={formData.documentDate}
                   onChange={(e) => setFormData({ ...formData, documentDate: e.target.value })}
                 />
               </div>
               <div className="space-y-2">
                 <Label htmlFor="editExpiry">Expiry Date</Label>
                 <Input
                   id="editExpiry"
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
                   <span className="text-sm">Confidential</span>
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
             <Button type="submit" disabled={updateDocument.isPending}>
               {updateDocument.isPending ? (
                 <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>
               ) : (
                 'Save Changes'
               )}
             </Button>
           </DialogFooter>
         </form>
       </DialogContent>
     </Dialog>
   );
 }