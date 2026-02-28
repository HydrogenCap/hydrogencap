 import React, { useState, useEffect } from 'react';
 import { Loader2, Building2 } from 'lucide-react';
 import { 
   Dialog, 
   DialogContent, 
   DialogDescription, 
   DialogFooter, 
   DialogHeader, 
   DialogTitle 
 } from '@/components/ui/dialog';
 import { Button } from '@/components/ui/button';
 import { Label } from '@/components/ui/label';
 import { Textarea } from '@/components/ui/textarea';
 import { 
   Select, 
   SelectContent, 
   SelectItem, 
   SelectTrigger, 
   SelectValue 
 } from '@/components/ui/select';
 import { useCreateJob, JOB_PRIORITIES, JobPriority } from '@/hooks/useContractorJobs';
 import { usePropertiesCompat as useProperties } from '@/hooks/usePropertiesCompat';
import { useAllCompliance } from '@/hooks/useCompliance';
 import { COMPLIANCE_TYPES } from '@/lib/schemas/compliance';
 import { formatDateUK } from '@/lib/calculations';
 
 interface CreateJobDialogProps {
   open: boolean;
   onOpenChange: (open: boolean) => void;
   preselectedPropertyId?: string;
   preselectedComplianceItemId?: string;
 }
 
 export function CreateJobDialog({ 
   open, 
   onOpenChange, 
   preselectedPropertyId,
   preselectedComplianceItemId 
 }: CreateJobDialogProps) {
   const [formData, setFormData] = useState({
     propertyId: preselectedPropertyId || '',
     complianceItemId: preselectedComplianceItemId || '',
     jobType: '',
     description: '',
     priority: 'normal' as JobPriority,
   });
 
   const { data: properties } = useProperties();
  const { data: allComplianceData } = useAllCompliance();
   const createJob = useCreateJob();
 
   // Filter compliance items for the selected property
   const complianceItems = allComplianceData?.items?.filter(c => c.property_id === formData.propertyId);
 
   // Update form data when preselected values change
   useEffect(() => {
     if (preselectedPropertyId) {
       setFormData(prev => ({ ...prev, propertyId: preselectedPropertyId }));
     }
     if (preselectedComplianceItemId) {
       setFormData(prev => ({ ...prev, complianceItemId: preselectedComplianceItemId }));
     }
   }, [preselectedPropertyId, preselectedComplianceItemId]);
 
   // Filter to operational properties
   const availableProperties = properties?.filter(p => p.lifecycle_type === 'core_rental');
 
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Convert "none" to undefined for compliance_item_id
    const complianceItemId = formData.complianceItemId && formData.complianceItemId !== 'none' 
      ? formData.complianceItemId 
      : undefined;

    await createJob.mutateAsync({
      propertyId: formData.propertyId,
      complianceItemId,
      jobType: formData.jobType,
      description: formData.description || undefined,
      priority: formData.priority,
    });
 
     onOpenChange(false);
     setFormData({
       propertyId: '',
       complianceItemId: '',
       jobType: '',
       description: '',
       priority: 'normal',
     });
   };
 
   // Auto-fill job type when compliance item selected
   const handleComplianceChange = (complianceItemId: string) => {
     const item = complianceItems?.find(c => c.id === complianceItemId);
     setFormData(prev => ({
       ...prev,
       complianceItemId,
       jobType: item?.compliance_type || prev.jobType,
     }));
   };
 
   return (
     <Dialog open={open} onOpenChange={onOpenChange}>
       <DialogContent>
         <form onSubmit={handleSubmit}>
           <DialogHeader>
             <DialogTitle>Create New Job</DialogTitle>
             <DialogDescription>
               Create a job to track work needed at a property.
             </DialogDescription>
           </DialogHeader>
 
           <div className="space-y-4 py-4">
             {/* Property Selection */}
             <div className="space-y-2">
               <Label>Property *</Label>
               <Select
                 value={formData.propertyId}
                 onValueChange={(v) => setFormData({ ...formData, propertyId: v, complianceItemId: '' })}
                 required
               >
                 <SelectTrigger>
                   <SelectValue placeholder="Select a property..." />
                 </SelectTrigger>
                 <SelectContent>
                   {availableProperties?.map(property => (
                     <SelectItem key={property.id} value={property.id}>
                       <div className="flex items-center gap-2">
                         <Building2 className="h-4 w-4 text-muted-foreground" />
                         <span>{property.address_line?.split(',')[0]}</span>
                         <span className="text-muted-foreground">({property.postcode})</span>
                       </div>
                     </SelectItem>
                   ))}
                 </SelectContent>
               </Select>
             </div>
 
             {/* Link to Compliance Item (Optional) */}
             {formData.propertyId && complianceItems && complianceItems.length > 0 && (
               <div className="space-y-2">
                 <Label>Link to Compliance Item (optional)</Label>
                 <Select
                   value={formData.complianceItemId}
                   onValueChange={handleComplianceChange}
                 >
                   <SelectTrigger>
                     <SelectValue placeholder="Select compliance item..." />
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem value="none">None</SelectItem>
                     {complianceItems.map(item => (
                       <SelectItem key={item.id} value={item.id}>
                         {item.compliance_type}
                         {item.expiry_date && (
                           <span className="text-muted-foreground ml-2">
                             (expires {formatDateUK(item.expiry_date)})
                           </span>
                         )}
                       </SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
               </div>
             )}
 
             {/* Job Type */}
             <div className="space-y-2">
               <Label>Job Type *</Label>
               <Select
                 value={formData.jobType}
                 onValueChange={(v) => setFormData({ ...formData, jobType: v })}
                 required
               >
                 <SelectTrigger>
                   <SelectValue placeholder="Select job type..." />
                 </SelectTrigger>
                 <SelectContent>
                   {COMPLIANCE_TYPES.map(type => (
                     <SelectItem key={type} value={type}>{type}</SelectItem>
                   ))}
                   <SelectItem value="General Maintenance">General Maintenance</SelectItem>
                   <SelectItem value="Repair">Repair</SelectItem>
                   <SelectItem value="Other">Other</SelectItem>
                 </SelectContent>
               </Select>
             </div>
 
             {/* Priority */}
             <div className="space-y-2">
               <Label>Priority</Label>
               <Select
                 value={formData.priority}
                 onValueChange={(v) => setFormData({ ...formData, priority: v as JobPriority })}
               >
                 <SelectTrigger>
                   <SelectValue />
                 </SelectTrigger>
                 <SelectContent>
                   {JOB_PRIORITIES.map(p => (
                     <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                   ))}
                 </SelectContent>
               </Select>
             </div>
 
             {/* Description */}
             <div className="space-y-2">
               <Label>Description (optional)</Label>
               <Textarea
                 value={formData.description}
                 onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                 placeholder="Add any details about this job..."
                 rows={3}
               />
             </div>
           </div>
 
           <DialogFooter>
             <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
               Cancel
             </Button>
             <Button
               type="submit"
               disabled={!formData.propertyId || !formData.jobType || createJob.isPending}
             >
               {createJob.isPending ? (
                 <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating...</>
               ) : (
                 'Create Job'
               )}
             </Button>
           </DialogFooter>
         </form>
       </DialogContent>
     </Dialog>
   );
 }