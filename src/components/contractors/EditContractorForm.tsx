 import React, { useState } from 'react';
 import { Loader2, Star } from 'lucide-react';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Label } from '@/components/ui/label';
 import { Textarea } from '@/components/ui/textarea';
 import { Checkbox } from '@/components/ui/checkbox';
 import { Badge } from '@/components/ui/badge';
 import { useUpdateContractor, type Contractor } from '@/hooks/useContractors';
 import { COMPLIANCE_TYPES } from '@/lib/complianceTypes';
 
 interface EditContractorFormProps {
   contractor: Contractor;
   onSave: () => void;
   onCancel: () => void;
 }
 
 export function EditContractorForm({ contractor, onSave, onCancel }: EditContractorFormProps) {
   const [formData, setFormData] = useState({
     name: contractor.name,
     company_name: contractor.company_name || '',
     email: contractor.email || '',
     phone: contractor.phone || '',
     website: contractor.website || '',
     compliance_types: contractor.compliance_types || [],
     notes: contractor.notes || '',
     is_preferred: contractor.is_preferred,
     hourly_rate_gbp: contractor.hourly_rate_gbp?.toString() || '',
     call_out_fee_gbp: contractor.call_out_fee_gbp?.toString() || '',
     availability_notes: contractor.availability_notes || '',
   });
 
   const updateContractor = useUpdateContractor();
 
   const handleSubmit = async (e: React.FormEvent) => {
     e.preventDefault();
     
     await updateContractor.mutateAsync({
       id: contractor.id,
       name: formData.name,
       company_name: formData.company_name || null,
       email: formData.email || null,
       phone: formData.phone || null,
       website: formData.website || null,
       compliance_types: formData.compliance_types,
       notes: formData.notes || null,
       is_preferred: formData.is_preferred,
       hourly_rate_gbp: formData.hourly_rate_gbp ? parseInt(formData.hourly_rate_gbp) : null,
       call_out_fee_gbp: formData.call_out_fee_gbp ? parseInt(formData.call_out_fee_gbp) : null,
       availability_notes: formData.availability_notes || null,
     });
 
     onSave();
   };
 
   const toggleComplianceType = (type: string) => {
     setFormData(prev => ({
       ...prev,
       compliance_types: prev.compliance_types.includes(type)
         ? prev.compliance_types.filter(t => t !== type)
         : [...prev.compliance_types, type],
     }));
   };
 
   return (
     <form onSubmit={handleSubmit} className="space-y-4">
       <div className="grid grid-cols-2 gap-4">
         <div className="space-y-2">
           <Label htmlFor="name">Contact Name *</Label>
           <Input
             id="name"
             value={formData.name}
             onChange={(e) => setFormData({ ...formData, name: e.target.value })}
             required
           />
         </div>
         <div className="space-y-2">
           <Label htmlFor="company">Company Name</Label>
           <Input
             id="company"
             value={formData.company_name}
             onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
           />
         </div>
       </div>
 
       <div className="grid grid-cols-2 gap-4">
         <div className="space-y-2">
           <Label htmlFor="email">Email</Label>
           <Input
             id="email"
             type="email"
             value={formData.email}
             onChange={(e) => setFormData({ ...formData, email: e.target.value })}
           />
         </div>
         <div className="space-y-2">
           <Label htmlFor="phone">Phone</Label>
           <Input
             id="phone"
             value={formData.phone}
             onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
           />
         </div>
       </div>
 
       <div className="space-y-2">
         <Label>Services</Label>
         <div className="flex flex-wrap gap-2 p-3 border rounded-lg max-h-32 overflow-y-auto">
           {COMPLIANCE_TYPES.filter(t => t !== 'Other').map(type => (
             <Badge
               key={type}
               variant={formData.compliance_types.includes(type) ? 'default' : 'outline'}
               className="cursor-pointer text-xs"
               onClick={() => toggleComplianceType(type)}
             >
               {type.split('(')[0].trim()}
             </Badge>
           ))}
         </div>
       </div>
 
       <div className="grid grid-cols-2 gap-4">
         <div className="space-y-2">
           <Label htmlFor="hourly">Hourly Rate (£)</Label>
           <Input
             id="hourly"
             type="number"
             value={formData.hourly_rate_gbp}
             onChange={(e) => setFormData({ ...formData, hourly_rate_gbp: e.target.value })}
           />
         </div>
         <div className="space-y-2">
           <Label htmlFor="callout">Call-out Fee (£)</Label>
           <Input
             id="callout"
             type="number"
             value={formData.call_out_fee_gbp}
             onChange={(e) => setFormData({ ...formData, call_out_fee_gbp: e.target.value })}
           />
         </div>
       </div>
 
       <div className="space-y-2">
         <Label htmlFor="notes">Notes</Label>
         <Textarea
           id="notes"
           value={formData.notes}
           onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
           rows={2}
         />
       </div>
 
       <div className="flex items-center space-x-2">
         <Checkbox
           id="preferred"
           checked={formData.is_preferred}
           onCheckedChange={(checked) => setFormData({ ...formData, is_preferred: !!checked })}
         />
         <label htmlFor="preferred" className="text-sm cursor-pointer flex items-center gap-2">
           <Star className="h-4 w-4 text-amber-400" />
           Preferred contractor
         </label>
       </div>
 
       <div className="flex gap-2 pt-4">
         <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
           Cancel
         </Button>
         <Button type="submit" disabled={!formData.name || updateContractor.isPending} className="flex-1">
           {updateContractor.isPending ? (
             <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>
           ) : (
             'Save Changes'
           )}
         </Button>
       </div>
     </form>
   );
 }