 import React, { useState } from 'react';
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
 import { useCreateInsurancePolicy, POLICY_TYPES } from '@/hooks/useInsurance';
 import { useProperties } from '@/hooks/useProperties';
 
 interface AddInsuranceDialogProps {
   open: boolean;
   onOpenChange: (open: boolean) => void;
   propertyId?: string;
 }
 
 export function AddInsuranceDialog({ open, onOpenChange, propertyId }: AddInsuranceDialogProps) {
   const [formData, setFormData] = useState({
     propertyId: propertyId || '',
     insurerName: '',
     policyNumber: '',
     policyType: 'landlord',
     coverType: '',
     startDate: '',
     renewalDate: '',
     premiumGbp: '',
     excessGbp: '',
     paymentFrequency: 'annual',
     autoRenew: false,
     buildingsCoverGbp: '',
     contentsCoverGbp: '',
     notes: '',
   });
 
   const { data: properties } = useProperties();
   const createPolicy = useCreateInsurancePolicy();
 
   const handleSubmit = async (e: React.FormEvent) => {
     e.preventDefault();
 
     await createPolicy.mutateAsync({
       propertyId: formData.propertyId,
       insurerName: formData.insurerName,
       policyNumber: formData.policyNumber || undefined,
       policyType: formData.policyType,
       coverType: formData.coverType || undefined,
       startDate: formData.startDate || undefined,
       renewalDate: formData.renewalDate,
       premiumGbp: Number(formData.premiumGbp),
       excessGbp: formData.excessGbp ? Number(formData.excessGbp) : undefined,
       paymentFrequency: formData.paymentFrequency,
       autoRenew: formData.autoRenew,
       buildingsCoverGbp: formData.buildingsCoverGbp ? Number(formData.buildingsCoverGbp) : undefined,
       contentsCoverGbp: formData.contentsCoverGbp ? Number(formData.contentsCoverGbp) : undefined,
       notes: formData.notes || undefined,
     });
 
     onOpenChange(false);
     setFormData({
       propertyId: propertyId || '',
       insurerName: '',
       policyNumber: '',
       policyType: 'landlord',
       coverType: '',
       startDate: '',
       renewalDate: '',
       premiumGbp: '',
       excessGbp: '',
       paymentFrequency: 'annual',
       autoRenew: false,
       buildingsCoverGbp: '',
       contentsCoverGbp: '',
       notes: '',
     });
   };
 
   return (
     <Dialog open={open} onOpenChange={onOpenChange}>
       <DialogContent className="max-w-lg">
         <form onSubmit={handleSubmit}>
           <DialogHeader>
             <DialogTitle>Add Insurance Policy</DialogTitle>
           </DialogHeader>
 
           <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
             {/* Property (if not pre-selected) */}
             {!propertyId && (
               <div className="space-y-2">
                 <Label>Property *</Label>
                 <Select
                   value={formData.propertyId}
                   onValueChange={(v) => setFormData({ ...formData, propertyId: v })}
                 >
                   <SelectTrigger>
                     <SelectValue placeholder="Select property..." />
                   </SelectTrigger>
                   <SelectContent>
                     {properties?.map(p => (
                       <SelectItem key={p.id} value={p.id}>
                         {p.address_line?.split(',')[0]} ({p.postcode})
                       </SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
               </div>
             )}
 
             {/* Provider */}
             <div className="space-y-2">
               <Label htmlFor="insurerName">Insurance Provider *</Label>
               <Input
                 id="insurerName"
                 value={formData.insurerName}
                 onChange={(e) => setFormData({ ...formData, insurerName: e.target.value })}
                 placeholder="e.g., Simply Business, Alan Boswell"
                 required
               />
             </div>
 
             {/* Policy Number */}
             <div className="space-y-2">
               <Label htmlFor="policyNumber">Policy Number</Label>
               <Input
                 id="policyNumber"
                 value={formData.policyNumber}
                 onChange={(e) => setFormData({ ...formData, policyNumber: e.target.value })}
                 placeholder="e.g., POL123456"
               />
             </div>
 
             {/* Policy Type */}
             <div className="space-y-2">
               <Label>Policy Type *</Label>
               <Select
                 value={formData.policyType}
                 onValueChange={(v) => setFormData({ ...formData, policyType: v })}
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
                 <Label htmlFor="startDate">Start Date</Label>
                 <Input
                   id="startDate"
                   type="date"
                   value={formData.startDate}
                   onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                 />
               </div>
               <div className="space-y-2">
                 <Label htmlFor="renewalDate">Renewal Date *</Label>
                 <Input
                   id="renewalDate"
                   type="date"
                   value={formData.renewalDate}
                   onChange={(e) => setFormData({ ...formData, renewalDate: e.target.value })}
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
                   value={formData.premiumGbp}
                   onChange={(e) => setFormData({ ...formData, premiumGbp: e.target.value })}
                   placeholder="e.g., 450"
                   required
                 />
               </div>
               <div className="space-y-2">
                 <Label htmlFor="excess">Excess (£)</Label>
                 <Input
                   id="excess"
                   type="number"
                   value={formData.excessGbp}
                   onChange={(e) => setFormData({ ...formData, excessGbp: e.target.value })}
                   placeholder="e.g., 250"
                 />
               </div>
             </div>
 
             {/* Payment Frequency */}
             <div className="space-y-2">
               <Label>Payment Frequency</Label>
               <Select
                 value={formData.paymentFrequency}
                 onValueChange={(v) => setFormData({ ...formData, paymentFrequency: v })}
               >
                 <SelectTrigger>
                   <SelectValue />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="annual">Annual (paid yearly)</SelectItem>
                   <SelectItem value="monthly">Monthly (paid monthly)</SelectItem>
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
                   value={formData.buildingsCoverGbp}
                   onChange={(e) => setFormData({ ...formData, buildingsCoverGbp: e.target.value })}
                   placeholder="e.g., 350000"
                 />
               </div>
               <div className="space-y-2">
                 <Label htmlFor="contentsCover">Contents Cover (£)</Label>
                 <Input
                   id="contentsCover"
                   type="number"
                   value={formData.contentsCoverGbp}
                   onChange={(e) => setFormData({ ...formData, contentsCoverGbp: e.target.value })}
                   placeholder="e.g., 15000"
                 />
               </div>
             </div>
 
             {/* Auto Renew */}
             <label className="flex items-center gap-2">
               <Checkbox
                 checked={formData.autoRenew}
                 onCheckedChange={(c) => setFormData({ ...formData, autoRenew: !!c })}
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
                 placeholder="Any additional notes..."
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
               disabled={!formData.propertyId || !formData.insurerName || !formData.renewalDate || !formData.premiumGbp || createPolicy.isPending}
             >
               {createPolicy.isPending ? (
                 <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Adding...</>
               ) : (
                 'Add Policy'
               )}
             </Button>
           </DialogFooter>
         </form>
       </DialogContent>
     </Dialog>
   );
 }