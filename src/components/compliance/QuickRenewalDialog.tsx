 import React, { useState } from 'react';
 import { format, addYears, addMonths } from 'date-fns';
 import { Upload, Calendar, User, FileCheck, Loader2, CheckCircle } from 'lucide-react';
 import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Label } from '@/components/ui/label';
 import { Textarea } from '@/components/ui/textarea';
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
 import { useContractors } from '@/hooks/useContractors';
 import { useUpdateComplianceItem, useUploadComplianceDocument } from '@/hooks/useCompliance';
 import { useToast } from '@/hooks/use-toast';
 
 // Standard validity periods for UK compliance certificates
 const STANDARD_VALIDITY: Record<string, { years?: number; months?: number }> = {
   'Gas Safety Certificate (CP12)': { years: 1 },
   'Electrical Safety Certificate (EICR)': { years: 5 },
   'EPC': { years: 10 },
   'Fire Alarm Certificate': { years: 1 },
   'Emergency Lighting Certificate': { years: 1 },
   'Fire Risk Assessment (FRA)': { years: 1 },
   'PAT Testing': { years: 1 },
   'Legionella Risk Assessment': { years: 2 },
   'HMO Licence': { years: 5 },
   'Fire Suppression System Certificate': { years: 1 },
 };
 
 interface QuickRenewalDialogProps {
   open: boolean;
   onOpenChange: (open: boolean) => void;
   complianceItem: {
     id: string;
     property_id: string;
     compliance_type: string;
     expiry_date: string | null;
   };
   propertyAddress: string;
 }
 
 export function QuickRenewalDialog({ open, onOpenChange, complianceItem, propertyAddress }: QuickRenewalDialogProps) {
   const [step, setStep] = useState<'details' | 'success'>('details');
   const [newExpiryDate, setNewExpiryDate] = useState('');
   const [newIssueDate, setNewIssueDate] = useState(format(new Date(), 'yyyy-MM-dd'));
   const [selectedContractor, setSelectedContractor] = useState<string>('');
   const [notes, setNotes] = useState('');
   const [file, setFile] = useState<File | null>(null);
 
   const { data: contractors } = useContractors(complianceItem.compliance_type);
   const updateItem = useUpdateComplianceItem();
   const uploadDoc = useUploadComplianceDocument();
   const { toast } = useToast();
 
   const isUpdating = updateItem.isPending || uploadDoc.isPending;
 
   // Calculate default expiry based on standard validity
   const getDefaultExpiry = (issueDate: string) => {
     const validity = STANDARD_VALIDITY[complianceItem.compliance_type];
     if (!validity) return '';
     
     const issue = new Date(issueDate);
     if (validity.years) {
       return format(addYears(issue, validity.years), 'yyyy-MM-dd');
     }
     if (validity.months) {
       return format(addMonths(issue, validity.months), 'yyyy-MM-dd');
     }
     return '';
   };
 
   const handleIssueDateChange = (date: string) => {
     setNewIssueDate(date);
     // Auto-set expiry based on standard validity
     const defaultExpiry = getDefaultExpiry(date);
     if (defaultExpiry && !newExpiryDate) {
       setNewExpiryDate(defaultExpiry);
     }
   };
 
   const handleQuickExpiry = (type: '6mo' | '12mo' | '5yr') => {
     const baseDate = newIssueDate ? new Date(newIssueDate) : new Date();
     let expiry: Date;
     switch (type) {
       case '6mo':
         expiry = addMonths(baseDate, 6);
         break;
       case '12mo':
         expiry = addYears(baseDate, 1);
         break;
       case '5yr':
         expiry = addYears(baseDate, 5);
         break;
     }
     setNewExpiryDate(format(expiry, 'yyyy-MM-dd'));
   };
 
   const handleSubmit = async () => {
     try {
       // Update the compliance item (cast to any for new renewal fields from migration)
       await updateItem.mutateAsync({
         id: complianceItem.id,
         issue_date: newIssueDate,
         expiry_date: newExpiryDate,
         renewal_status: 'completed',
         renewal_contractor_id: selectedContractor || null,
         renewal_notes: notes || null,
       } as any);
 
       // Upload document if provided
       if (file) {
         await uploadDoc.mutateAsync({
           complianceItemId: complianceItem.id,
           propertyId: complianceItem.property_id,
           file,
           complianceType: complianceItem.compliance_type,
           propertyAddress,
           notes: `Renewal - ${format(new Date(), 'dd/MM/yyyy')}`,
         });
       }
 
       setStep('success');
       
       setTimeout(() => {
         onOpenChange(false);
         resetForm();
       }, 2000);
 
     } catch (error) {
       toast({
         title: 'Failed to update',
         description: 'Please try again.',
         variant: 'destructive',
       });
     }
   };
 
   const resetForm = () => {
     setStep('details');
     setNewExpiryDate('');
     setNewIssueDate(format(new Date(), 'yyyy-MM-dd'));
     setSelectedContractor('');
     setNotes('');
     setFile(null);
   };
 
   return (
     <Dialog open={open} onOpenChange={(open) => { if (!open) resetForm(); onOpenChange(open); }}>
       <DialogContent>
         <DialogHeader>
           <DialogTitle className="flex items-center gap-2">
             <FileCheck className="h-5 w-5 text-primary" />
             Mark as Renewed
           </DialogTitle>
           <DialogDescription>
             Update {complianceItem.compliance_type} for {propertyAddress}
           </DialogDescription>
         </DialogHeader>
 
         {step === 'success' ? (
           <div className="py-8 text-center">
             <CheckCircle className="h-16 w-16 text-success mx-auto mb-4" />
             <h3 className="text-lg font-semibold">Renewal Complete!</h3>
             <p className="text-muted-foreground">The compliance item has been updated.</p>
           </div>
         ) : (
           <>
             <div className="space-y-4 py-4">
               {/* Dates */}
               <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                   <Label>New Issue Date</Label>
                   <Input
                     type="date"
                     value={newIssueDate}
                     onChange={(e) => handleIssueDateChange(e.target.value)}
                     max={format(new Date(), 'yyyy-MM-dd')}
                   />
                 </div>
                 <div className="space-y-2">
                   <Label>New Expiry Date *</Label>
                   <Input
                     type="date"
                     value={newExpiryDate}
                     onChange={(e) => setNewExpiryDate(e.target.value)}
                     min={newIssueDate || format(new Date(), 'yyyy-MM-dd')}
                     required
                   />
                 </div>
               </div>
 
               {/* Quick-fill buttons */}
               <div className="flex gap-2">
                 <Button type="button" variant="outline" size="sm" onClick={() => handleQuickExpiry('6mo')}>+6 months</Button>
                 <Button type="button" variant="outline" size="sm" onClick={() => handleQuickExpiry('12mo')}>+12 months</Button>
                 <Button type="button" variant="outline" size="sm" onClick={() => handleQuickExpiry('5yr')}>+5 years</Button>
               </div>
 
               {/* Contractor */}
               {contractors && contractors.length > 0 && (
                 <div className="space-y-2">
                   <Label>Contractor Used (optional)</Label>
                   <Select value={selectedContractor} onValueChange={setSelectedContractor}>
                     <SelectTrigger>
                       <SelectValue placeholder="Select contractor..." />
                     </SelectTrigger>
                     <SelectContent>
                       {contractors.map(c => (
                         <SelectItem key={c.id} value={c.id}>
                           <div className="flex items-center gap-2">
                             <User className="h-4 w-4" />
                             {c.name} {c.company_name && `(${c.company_name})`}
                           </div>
                         </SelectItem>
                       ))}
                     </SelectContent>
                   </Select>
                 </div>
               )}
 
               {/* File Upload */}
               <div className="space-y-2">
                 <Label>Upload New Certificate (optional)</Label>
                 <div className="border-2 border-dashed rounded-lg p-4 text-center">
                   {file ? (
                     <div className="flex items-center justify-center gap-2">
                       <FileCheck className="h-5 w-5 text-success" />
                       <span className="text-sm">{file.name}</span>
                       <Button variant="ghost" size="sm" onClick={() => setFile(null)}>Remove</Button>
                     </div>
                   ) : (
                     <label className="cursor-pointer">
                       <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                       <p className="text-sm text-muted-foreground">Click to upload or drag and drop</p>
                       <input
                         type="file"
                         className="hidden"
                         accept=".pdf,.jpg,.jpeg,.png"
                         onChange={(e) => setFile(e.target.files?.[0] || null)}
                       />
                     </label>
                   )}
                 </div>
               </div>
 
               {/* Notes */}
               <div className="space-y-2">
                 <Label>Notes (optional)</Label>
                 <Textarea
                   value={notes}
                   onChange={(e) => setNotes(e.target.value)}
                   placeholder="Any notes about this renewal..."
                   rows={2}
                 />
               </div>
             </div>
 
             <DialogFooter>
               <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
               <Button onClick={handleSubmit} disabled={!newExpiryDate || isUpdating}>
                 {isUpdating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                 Mark as Renewed
               </Button>
             </DialogFooter>
           </>
         )}
       </DialogContent>
     </Dialog>
   );
 }