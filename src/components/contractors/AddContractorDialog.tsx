 import React, { useState } from 'react';
 import { Loader2, Plus, Star } from 'lucide-react';
 import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Label } from '@/components/ui/label';
 import { Textarea } from '@/components/ui/textarea';
 import { Checkbox } from '@/components/ui/checkbox';
 import { Badge } from '@/components/ui/badge';
 import { useCreateContractor } from '@/hooks/useContractors';
import { useToast } from '@/hooks/use-toast';
 import { COMPLIANCE_TYPES } from '@/lib/schemas/compliance';
 
 interface AddContractorDialogProps {
   open: boolean;
   onOpenChange: (open: boolean) => void;
 }
 
 export function AddContractorDialog({ open, onOpenChange }: AddContractorDialogProps) {
   const [formData, setFormData] = useState({
     name: '',
     company_name: '',
     email: '',
     phone: '',
     website: '',
     compliance_types: [] as string[],
     service_areas: [] as string[],
     notes: '',
     is_preferred: false,
     hourly_rate_gbp: '',
     call_out_fee_gbp: '',
   });
 
   const createContractor = useCreateContractor();
   const { toast } = useToast();
 
   const handleSubmit = async (e: React.FormEvent) => {
     e.preventDefault();
     try {
     await createContractor.mutateAsync({
       name: formData.name,
       company_name: formData.company_name || null,
       email: formData.email || null,
       phone: formData.phone || null,
       website: formData.website || null,
       compliance_types: formData.compliance_types,
       service_areas: formData.service_areas,
       notes: formData.notes || null,
       is_preferred: formData.is_preferred,
       is_active: true,
       hourly_rate_gbp: formData.hourly_rate_gbp ? parseInt(formData.hourly_rate_gbp) : null,
       call_out_fee_gbp: formData.call_out_fee_gbp ? parseInt(formData.call_out_fee_gbp) : null,
       typical_costs: {},
       availability_notes: null,
       avg_response_hours: null,
     });
     } catch (err) {
       toast({ title: 'Failed to save contractor', description: err instanceof Error ? err.message : 'Please try again.', variant: 'destructive' });
       return;
     }
 
     onOpenChange(false);
     setFormData({
       name: '',
       company_name: '',
       email: '',
       phone: '',
       website: '',
       compliance_types: [],
       service_areas: [],
       notes: '',
       is_preferred: false,
       hourly_rate_gbp: '',
       call_out_fee_gbp: '',
     });
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
     <Dialog open={open} onOpenChange={onOpenChange}>
       <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
         <form onSubmit={handleSubmit}>
           <DialogHeader>
             <DialogTitle>Add Contractor</DialogTitle>
             <DialogDescription>
               Add a new contractor or service provider to your directory.
             </DialogDescription>
           </DialogHeader>
 
           <div className="space-y-6 py-4">
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
               <Label>Services Provided</Label>
               <div className="flex flex-wrap gap-2 p-3 border rounded-lg max-h-40 overflow-y-auto">
                {COMPLIANCE_TYPES.map(type => (
                   <Badge
                     key={type}
                     variant={formData.compliance_types.includes(type) ? 'default' : 'outline'}
                     className="cursor-pointer"
                     onClick={() => toggleComplianceType(type)}
                   >
                     {type.split('(')[0].trim()}
                   </Badge>
                 ))}
               </div>
               <p className="text-xs text-muted-foreground">Click to select services this contractor provides</p>
             </div>
 
             <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                 <Label htmlFor="hourly">Hourly Rate (£)</Label>
                 <Input
                   id="hourly"
                   type="number"
                   value={formData.hourly_rate_gbp}
                   onChange={(e) => setFormData({ ...formData, hourly_rate_gbp: e.target.value })}
                   placeholder="Optional"
                 />
               </div>
               <div className="space-y-2">
                 <Label htmlFor="callout">Call-out Fee (£)</Label>
                 <Input
                   id="callout"
                   type="number"
                   value={formData.call_out_fee_gbp}
                   onChange={(e) => setFormData({ ...formData, call_out_fee_gbp: e.target.value })}
                   placeholder="Optional"
                 />
               </div>
             </div>
 
             <div className="space-y-2">
               <Label htmlFor="notes">Notes</Label>
               <Textarea
                 id="notes"
                 value={formData.notes}
                 onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                 placeholder="Any additional notes about this contractor..."
                 rows={3}
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
                 Mark as preferred contractor
               </label>
             </div>
           </div>
 
           <DialogFooter>
             <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
               Cancel
             </Button>
             <Button type="submit" disabled={!formData.name || createContractor.isPending}>
               {createContractor.isPending ? (
                 <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Adding...</>
               ) : (
                 <><Plus className="h-4 w-4 mr-2" />Add Contractor</>
               )}
             </Button>
           </DialogFooter>
         </form>
       </DialogContent>
     </Dialog>
   );
 }