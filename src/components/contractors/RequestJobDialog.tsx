 import React, { useState } from 'react';
 import { Loader2, Send, User, Star, Phone, Mail } from 'lucide-react';
 import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
 import { Button } from '@/components/ui/button';
 import { Label } from '@/components/ui/label';
 import { Textarea } from '@/components/ui/textarea';
 import { Badge } from '@/components/ui/badge';
 import { ScrollArea } from '@/components/ui/scroll-area';
 import { useMatchingContractors, type MatchingContractor } from '@/hooks/useContractorJobs';
 import { useContractors, type Contractor } from '@/hooks/useContractors';
 import { useCreateJob, useSendJobRequest } from '@/hooks/useContractorJobs';
 import { useToast } from '@/hooks/use-toast';
 import { formatDateUK } from '@/lib/calculations';
 
 interface RequestJobDialogProps {
   open: boolean;
   onOpenChange: (open: boolean) => void;
   propertyId: string;
   propertyAddress: string;
   propertyPostcode: string;
   complianceItemId?: string;
   complianceType: string;
   expiryDate?: string | null;
 }
 
 export function RequestJobDialog({
   open,
   onOpenChange,
   propertyId,
   propertyAddress,
   propertyPostcode,
   complianceItemId,
   complianceType,
   expiryDate,
 }: RequestJobDialogProps) {
   const [step, setStep] = useState<'select' | 'message'>('select');
   const [selectedContractor, setSelectedContractor] = useState<Contractor | MatchingContractor | null>(null);
   const [customMessage, setCustomMessage] = useState('');
   const [isSubmitting, setIsSubmitting] = useState(false);
 
   const { data: matchingContractors, isLoading: loadingMatching } = useMatchingContractors(complianceType, propertyPostcode);
   const { data: allContractors, isLoading: loadingAll } = useContractors({ isActive: true });
 
   const createJob = useCreateJob();
   const sendJobRequest = useSendJobRequest();
   const { toast } = useToast();
 
   const handleSelectContractor = (contractor: Contractor | MatchingContractor) => {
     setSelectedContractor(contractor);
     setStep('message');
   };
 
   const handleSendRequest = async () => {
     if (!selectedContractor) return;
 
     setIsSubmitting(true);
     try {
       const contractorId = 'contractor_id' in selectedContractor ? selectedContractor.contractor_id : selectedContractor.id;
       
       const job = await createJob.mutateAsync({
         propertyId,
         complianceItemId,
         contractorId,
         jobType: complianceType,
         requestMessage: customMessage,
       });
 
       await sendJobRequest.mutateAsync({ jobId: job.id, customMessage });
       
       onOpenChange(false);
       resetForm();
     } catch (error) {
       console.error('Failed to send job request:', error);
       toast({ title: 'Error', description: error instanceof Error ? error.message : 'Something went wrong', variant: 'destructive' });
     } finally {
       setIsSubmitting(false);
     }
   };
 
   const resetForm = () => {
     setStep('select');
     setSelectedContractor(null);
     setCustomMessage('');
   };
 
  const isMatchingContractor = (
    contractor: Contractor | MatchingContractor | null,
  ): contractor is MatchingContractor => !!contractor && 'contractor_id' in contractor;
 
   return (
     <Dialog open={open} onOpenChange={(isOpen) => { onOpenChange(isOpen); if (!isOpen) resetForm(); }}>
       <DialogContent className="max-w-2xl">
         <DialogHeader>
           <DialogTitle>Request {complianceType}</DialogTitle>
           <DialogDescription>
             {propertyAddress}
             {expiryDate && (
               <span className="text-amber-600 ml-2">
                 Expires: {formatDateUK(expiryDate)}
               </span>
             )}
           </DialogDescription>
         </DialogHeader>
 
         {step === 'select' ? (
           <div className="py-4">
             {(loadingMatching || loadingAll) ? (
               <div className="flex items-center justify-center py-8">
                 <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
               </div>
             ) : (
               <ScrollArea className="h-[400px] pr-4">
                 {matchingContractors && matchingContractors.length > 0 && (
                   <div className="mb-6">
                     <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                       <Star className="h-4 w-4 text-amber-400" />
                       Recommended for this job
                     </h4>
                     <div className="space-y-2">
                       {matchingContractors.map(contractor => (
                         <ContractorSelectCard
                           key={contractor.contractor_id}
                           name={contractor.name}
                           companyName={contractor.company_name}
                           email={contractor.email}
                           phone={contractor.phone}
                           rating={contractor.average_rating}
                           totalJobs={contractor.total_jobs}
                           typicalCost={contractor.typical_cost}
                           matchScore={contractor.match_score}
                           onClick={() => handleSelectContractor(contractor)}
                         />
                       ))}
                     </div>
                   </div>
                 )}
 
                 {allContractors && allContractors.length > 0 && (
                   <div>
                     <h4 className="text-sm font-medium text-muted-foreground mb-3">
                       All Contractors
                     </h4>
                     <div className="space-y-2">
                       {allContractors
                         .filter(c => !matchingContractors?.some(m => m.contractor_id === c.id))
                         .map(contractor => (
                           <ContractorSelectCard
                             key={contractor.id}
                             name={contractor.name}
                             companyName={contractor.company_name}
                             email={contractor.email}
                             phone={contractor.phone}
                             rating={contractor.average_rating}
                             totalJobs={contractor.total_jobs}
                             isPreferred={contractor.is_preferred}
                             onClick={() => handleSelectContractor(contractor)}
                           />
                         ))}
                     </div>
                   </div>
                 )}
 
                 {(!matchingContractors || matchingContractors.length === 0) && (!allContractors || allContractors.length === 0) && (
                   <div className="text-center py-8 text-muted-foreground">
                     <User className="h-12 w-12 mx-auto mb-4 opacity-20" />
                     <p>No contractors found.</p>
                     <p className="text-sm">Add contractors in Settings first.</p>
                   </div>
                 )}
               </ScrollArea>
             )}
           </div>
         ) : (
           <>
             <div className="py-4 space-y-4">
               <div className="p-4 bg-muted/50 rounded-lg">
                 <div className="flex items-center gap-3">
                   <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                     <User className="h-5 w-5 text-primary" />
                   </div>
                   <div>
                     <p className="font-medium">{selectedContractor?.name}</p>
                     <p className="text-sm text-muted-foreground">
                       {isMatchingContractor(selectedContractor) ? selectedContractor?.email : (selectedContractor as Contractor)?.email}
                     </p>
                   </div>
                 </div>
               </div>
 
               <div className="space-y-2">
                 <Label htmlFor="message">Additional Message (optional)</Label>
                 <Textarea
                   id="message"
                   value={customMessage}
                   onChange={(e) => setCustomMessage(e.target.value)}
                   placeholder="Add any specific requirements, access instructions, or questions..."
                   rows={4}
                 />
                 <p className="text-xs text-muted-foreground">
                   The contractor will receive the property address, compliance type, and expiry date automatically.
                 </p>
               </div>
             </div>
 
             <DialogFooter>
               <Button variant="outline" onClick={() => setStep('select')}>Back</Button>
               <Button onClick={handleSendRequest} disabled={isSubmitting}>
                 {isSubmitting ? (
                   <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending...</>
                 ) : (
                   <><Send className="h-4 w-4 mr-2" />Send Request</>
                 )}
               </Button>
             </DialogFooter>
           </>
         )}
       </DialogContent>
     </Dialog>
   );
 }
 
 function ContractorSelectCard({
   name,
   companyName,
   email,
   phone,
   rating,
   totalJobs: _totalJobs,
   typicalCost,
   matchScore,
   isPreferred,
   onClick,
 }: {
   name: string;
   companyName?: string | null;
   email?: string | null;
   phone?: string | null;
   rating?: number;
   totalJobs?: number;
   typicalCost?: number | null;
   matchScore?: number;
   isPreferred?: boolean;
   onClick: () => void;
 }) {
   return (
     <button
       onClick={onClick}
       className="w-full p-3 text-left rounded-lg border hover:bg-muted/50 transition-colors"
     >
       <div className="flex items-start justify-between">
         <div>
           <div className="flex items-center gap-2">
             <span className="font-medium">{name}</span>
             {isPreferred && <Star className="h-4 w-4 fill-amber-400 text-amber-400" />}
             {matchScore && matchScore > 80 && (
               <Badge variant="secondary" className="text-xs">Best Match</Badge>
             )}
           </div>
           {companyName && <p className="text-sm text-muted-foreground">{companyName}</p>}
           <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
             {phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{phone}</span>}
             {email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{email}</span>}
           </div>
         </div>
         <div className="text-right">
           {rating !== undefined && rating > 0 && (
             <div className="flex items-center gap-1 text-sm">
               <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
               {rating.toFixed(1)}
             </div>
           )}
           {typicalCost && (
             <p className="text-xs text-muted-foreground">~£{typicalCost}</p>
           )}
         </div>
       </div>
     </button>
   );
 }
