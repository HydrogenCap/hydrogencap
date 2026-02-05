 import React, { useState } from 'react';
 import { Star, User, Send, Loader2, ChevronRight } from 'lucide-react';
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
 import { Badge } from '@/components/ui/badge';
 import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
 import { ScrollArea } from '@/components/ui/scroll-area';
 import { Checkbox } from '@/components/ui/checkbox';
 import { 
   ContractorJob, 
   useAssignContractor, 
   useSendJobRequest,
   useMatchingContractors 
 } from '@/hooks/useContractorJobs';
 import { cn } from '@/lib/utils';
 
 interface AssignContractorDialogProps {
   open: boolean;
   onOpenChange: (open: boolean) => void;
   job: ContractorJob;
 }
 
 export function AssignContractorDialog({ open, onOpenChange, job }: AssignContractorDialogProps) {
   const [step, setStep] = useState<'select' | 'message' | 'done'>('select');
   const [selectedContractorId, setSelectedContractorId] = useState<string | null>(null);
   const [customMessage, setCustomMessage] = useState('');
   const [sendImmediately, setSendImmediately] = useState(true);
 
   const { data: contractors, isLoading } = useMatchingContractors(
     job.job_type,
     job.property?.postcode || ''
   );
 
   const assignContractor = useAssignContractor();
   const sendRequest = useSendJobRequest();
 
   const selectedContractor = contractors?.find(c => c.contractor_id === selectedContractorId);
 
   const handleAssign = async () => {
     if (!selectedContractorId) return;
 
     // Assign the contractor
     await assignContractor.mutateAsync({
       jobId: job.id,
       contractorId: selectedContractorId,
     });
 
     if (sendImmediately) {
       // Send the request
       await sendRequest.mutateAsync({
         jobId: job.id,
         customMessage: customMessage || undefined,
       });
       setStep('done');
     } else {
       handleClose();
     }
   };
 
   const handleClose = () => {
     onOpenChange(false);
     setTimeout(() => {
       setStep('select');
       setSelectedContractorId(null);
       setCustomMessage('');
       setSendImmediately(true);
     }, 200);
   };
 
   const isSubmitting = assignContractor.isPending || sendRequest.isPending;
 
   const formatGBP = (value: number | null) => {
     if (value === null) return null;
     return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(value);
   };
 
   return (
     <Dialog open={open} onOpenChange={handleClose}>
       <DialogContent className="max-w-2xl">
         <DialogHeader>
           <DialogTitle>Assign Contractor</DialogTitle>
           <DialogDescription>
             {job.job_type} at {job.property?.address_line?.split(',')[0]}
           </DialogDescription>
         </DialogHeader>
 
         {step === 'done' ? (
           <div className="py-8 text-center">
             <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 mx-auto mb-4 flex items-center justify-center">
               <Send className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
             </div>
             <h3 className="text-lg font-semibold mb-2">Request Sent!</h3>
             <p className="text-muted-foreground mb-4">
               Job request sent to {selectedContractor?.name}.
             </p>
             <Button onClick={handleClose}>Done</Button>
           </div>
         ) : step === 'select' ? (
           <>
             <div className="py-4">
               <Label className="mb-3 block">Suggested Contractors</Label>
 
               {isLoading ? (
                 <div className="space-y-3">
                   {[1, 2, 3].map(i => (
                     <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
                   ))}
                 </div>
               ) : contractors?.length === 0 ? (
                 <div className="text-center py-8 text-muted-foreground">
                   <User className="h-12 w-12 mx-auto mb-3 opacity-30" />
                   <p>No contractors found for this job type.</p>
                   <Button variant="link" className="mt-2" asChild>
                     <a href="/contractors">Add a contractor</a>
                   </Button>
                 </div>
               ) : (
                 <RadioGroup
                   value={selectedContractorId || ''}
                   onValueChange={setSelectedContractorId}
                 >
                   <ScrollArea className="h-[300px] pr-4">
                     <div className="space-y-2">
                       {contractors?.map((contractor) => (
                         <label
                           key={contractor.contractor_id}
                           className={cn(
                             "flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors",
                             selectedContractorId === contractor.contractor_id
                               ? "border-primary bg-primary/5"
                               : "hover:bg-muted/50"
                           )}
                         >
                           <RadioGroupItem value={contractor.contractor_id} className="mt-1" />
                           <div className="flex-1 min-w-0">
                             <div className="flex items-center gap-2 mb-1">
                               <span className="font-medium">{contractor.name}</span>
                               {contractor.average_rating > 0 && (
                                 <Badge variant="secondary" className="text-xs">
                                   <Star className="h-3 w-3 mr-1 fill-amber-400 text-amber-400" />
                                   {contractor.average_rating.toFixed(1)}
                                 </Badge>
                               )}
                             </div>
                             {contractor.company_name && (
                               <p className="text-sm text-muted-foreground">{contractor.company_name}</p>
                             )}
                             <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                               {contractor.typical_cost && (
                                 <span>Typical: {formatGBP(contractor.typical_cost)}</span>
                               )}
                               {contractor.total_jobs > 0 && (
                                 <span>{contractor.total_jobs} jobs done</span>
                               )}
                             </div>
                           </div>
                         </label>
                       ))}
                     </div>
                   </ScrollArea>
                 </RadioGroup>
               )}
             </div>
 
             <DialogFooter>
               <Button variant="outline" onClick={handleClose}>Cancel</Button>
               <Button onClick={() => setStep('message')} disabled={!selectedContractorId}>
                 Continue
                 <ChevronRight className="h-4 w-4 ml-1" />
               </Button>
             </DialogFooter>
           </>
         ) : (
           <>
             <div className="py-4 space-y-4">
               {/* Selected contractor */}
               <div className="p-4 bg-muted/50 rounded-lg">
                 <div className="flex items-center gap-3">
                   <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                     <User className="h-5 w-5 text-primary" />
                   </div>
                   <div>
                     <p className="font-medium">{selectedContractor?.name}</p>
                     <p className="text-sm text-muted-foreground">
                       {selectedContractor?.company_name}
                     </p>
                   </div>
                 </div>
               </div>
 
               {/* Message */}
               <div className="space-y-2">
                 <Label>Additional Message (optional)</Label>
                 <Textarea
                   value={customMessage}
                   onChange={(e) => setCustomMessage(e.target.value)}
                   placeholder="Add any specific requirements or notes..."
                   rows={4}
                 />
               </div>
 
               {/* Send option */}
               <div className="flex items-center gap-2">
                 <Checkbox
                   id="sendImmediately"
                   checked={sendImmediately}
                   onCheckedChange={(checked) => setSendImmediately(checked as boolean)}
                 />
                 <label htmlFor="sendImmediately" className="text-sm cursor-pointer">
                   Send request to contractor immediately
                 </label>
               </div>
             </div>
 
             <DialogFooter>
               <Button variant="outline" onClick={() => setStep('select')}>Back</Button>
               <Button onClick={handleAssign} disabled={isSubmitting}>
                 {isSubmitting ? (
                   <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing...</>
                 ) : sendImmediately ? (
                   <><Send className="h-4 w-4 mr-2" />Assign & Send</>
                 ) : (
                   'Assign Contractor'
                 )}
               </Button>
             </DialogFooter>
           </>
         )}
       </DialogContent>
     </Dialog>
   );
 }