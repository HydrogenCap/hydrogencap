 import React, { useState, useEffect } from 'react';
 import { Loader2 } from 'lucide-react';
 import {
   Dialog,
   DialogContent,
   DialogHeader,
   DialogTitle,
   DialogFooter,
 } from '@/components/ui/dialog';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Label } from '@/components/ui/label';
 import { Textarea } from '@/components/ui/textarea';
 import { Checkbox } from '@/components/ui/checkbox';
 import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
 } from '@/components/ui/select';
 import { useUpdateInsurancePolicy, InsurancePolicy, POLICY_TYPES } from '@/hooks/useInsurance';
 
 interface EditInsuranceDialogProps {
   open: boolean;
   onOpenChange: (open: boolean) => void;
   policy: InsurancePolicy;
 }
 
 export function EditInsuranceDialog({ open, onOpenChange, policy }: EditInsuranceDialogProps) {
   const [formData, setFormData] = useState({
     insurer_name: '',
     policy_number: '',
     policy_type: 'landlord',
     cover_type: '',
     start_date: '',
     renewal_date: '',
     premium_gbp: '',
     excess_gbp: '',
     payment_frequency: 'annual',
     auto_renew: false,
     buildings_cover_gbp: '',
     contents_cover_gbp: '',
     notes: '',
   });
 
   const updatePolicy = useUpdateInsurancePolicy();
 
   useEffect(() => {
     if (policy) {
       setFormData({
         insurer_name: policy.insurer_name || '',
         policy_number: policy.policy_number || '',
         policy_type: policy.policy_type || 'landlord',
         cover_type: policy.cover_type || '',
         start_date: policy.start_date || '',
         renewal_date: policy.renewal_date || '',
         premium_gbp: String(policy.premium_gbp || ''),
         excess_gbp: String(policy.excess_gbp || ''),
         payment_frequency: policy.payment_frequency || 'annual',
         auto_renew: policy.auto_renew || false,
         buildings_cover_gbp: String(policy.buildings_cover_gbp || ''),
         contents_cover_gbp: String(policy.contents_cover_gbp || ''),
         notes: policy.notes || '',
       });
     }
   }, [policy]);
 
   const handleSubmit = async (e: React.FormEvent) => {
     e.preventDefault();
 
     await updatePolicy.mutateAsync({
       id: policy.id,
       insurer_name: formData.insurer_name,
       policy_number: formData.policy_number || null,
       policy_type: formData.policy_type,
       cover_type: formData.cover_type || null,
       start_date: formData.start_date || null,
       renewal_date: formData.renewal_date,
       premium_gbp: Number(formData.premium_gbp),
       excess_gbp: formData.excess_gbp ? Number(formData.excess_gbp) : null,
       payment_frequency: formData.payment_frequency,
       auto_renew: formData.auto_renew,
       buildings_cover_gbp: formData.buildings_cover_gbp ? Number(formData.buildings_cover_gbp) : null,
       contents_cover_gbp: formData.contents_cover_gbp ? Number(formData.contents_cover_gbp) : null,
       notes: formData.notes || null,
     });
 
     onOpenChange(false);
   };
 
   return (
     <Dialog open={open} onOpenChange={onOpenChange}>
       <DialogContent className="max-w-lg">
         <form onSubmit={handleSubmit}>
           <DialogHeader>
             <DialogTitle>Edit Insurance Policy</DialogTitle>
           </DialogHeader>
 
           <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
             {/* Provider */}
             <div className="space-y-2">
               <Label htmlFor="insurer_name">Insurance Provider *</Label>
               <Input
                 id="insurer_name"
                 value={formData.insurer_name}
                 onChange={(e) => setFormData({ ...formData, insurer_name: e.target.value })}
                 placeholder="e.g., Simply Business"
                 required
               />
             </div>
 
             {/* Policy Number */}
             <div className="space-y-2">
               <Label htmlFor="policy_number">Policy Number</Label>
               <Input
                 id="policy_number"
                 value={formData.policy_number}
                 onChange={(e) => setFormData({ ...formData, policy_number: e.target.value })}
                 placeholder="e.g., POL123456"
               />
             </div>
 
             {/* Policy Type */}
             <div className="space-y-2">
               <Label>Policy Type</Label>
               <Select
                 value={formData.policy_type}
                 onValueChange={(v) => setFormData({ ...formData, policy_type: v })}
               >
                 <SelectTrigger>
                   <SelectValue placeholder="Select type..." />
                 </SelectTrigger>
                 <SelectContent>
                   {POLICY_TYPES.map(type => (
                     <SelectItem key={type.value} value={type.value}>
                       {type.label}
                     </SelectItem>
                   ))}
                 </SelectContent>
               </Select>
             </div>
 
             {/* Dates */}
             <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                 <Label htmlFor="start_date">Start Date</Label>
                 <Input
                   id="start_date"
                   type="date"
                   value={formData.start_date}
                   onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                 />
               </div>
               <div className="space-y-2">
                 <Label htmlFor="renewal_date">Renewal Date *</Label>
                 <Input
                   id="renewal_date"
                   type="date"
                   value={formData.renewal_date}
                   onChange={(e) => setFormData({ ...formData, renewal_date: e.target.value })}
                   required
                 />
               </div>
             </div>
 
             {/* Premium & Excess */}
             <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                 <Label htmlFor="premium">Annual Premium (£) *</Label>
                 <Input
                   id="premium"
                   type="number"
                   value={formData.premium_gbp}
                   onChange={(e) => setFormData({ ...formData, premium_gbp: e.target.value })}
                   required
                 />
               </div>
               <div className="space-y-2">
                 <Label htmlFor="excess">Excess (£)</Label>
                 <Input
                   id="excess"
                   type="number"
                   value={formData.excess_gbp}
                   onChange={(e) => setFormData({ ...formData, excess_gbp: e.target.value })}
                 />
               </div>
             </div>
 
             {/* Payment Frequency */}
             <div className="space-y-2">
               <Label>Payment Frequency</Label>
               <Select
                 value={formData.payment_frequency}
                 onValueChange={(v) => setFormData({ ...formData, payment_frequency: v })}
               >
                 <SelectTrigger>
                   <SelectValue />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="annual">Annual</SelectItem>
                   <SelectItem value="monthly">Monthly</SelectItem>
                 </SelectContent>
               </Select>
             </div>
 
             {/* Cover Amounts */}
             <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                 <Label htmlFor="buildingsCover">Buildings Cover (£)</Label>
                 <Input
                   id="buildingsCover"
                   type="number"
                   value={formData.buildings_cover_gbp}
                   onChange={(e) => setFormData({ ...formData, buildings_cover_gbp: e.target.value })}
                 />
               </div>
               <div className="space-y-2">
                 <Label htmlFor="contentsCover">Contents Cover (£)</Label>
                 <Input
                   id="contentsCover"
                   type="number"
                   value={formData.contents_cover_gbp}
                   onChange={(e) => setFormData({ ...formData, contents_cover_gbp: e.target.value })}
                 />
               </div>
             </div>
 
             {/* Auto Renew */}
             <label className="flex items-center gap-2">
               <Checkbox
                 checked={formData.auto_renew}
                 onCheckedChange={(c) => setFormData({ ...formData, auto_renew: !!c })}
               />
               <span className="text-sm">Auto-renew enabled</span>
             </label>
 
             {/* Notes */}
             <div className="space-y-2">
               <Label htmlFor="notes">Notes</Label>
               <Textarea
                 id="notes"
                 value={formData.notes}
                 onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                 rows={2}
               />
             </div>
           </div>
 
           <DialogFooter>
             <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
               Cancel
             </Button>
             <Button
               type="submit"
               disabled={!formData.insurer_name || !formData.renewal_date || !formData.premium_gbp || updatePolicy.isPending}
             >
               {updatePolicy.isPending ? (
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