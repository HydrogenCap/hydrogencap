 import React, { useState } from 'react';
 import { Star, Phone, Mail, Globe, MapPin, Briefcase, CheckCircle, Edit2, X, Loader2, MessageSquare, Clock } from 'lucide-react';
 import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
 import { Button } from '@/components/ui/button';
 import { Badge } from '@/components/ui/badge';
 import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
 import { ScrollArea } from '@/components/ui/scroll-area';
 import { Separator } from '@/components/ui/separator';
 import { Card, CardContent } from '@/components/ui/card';
 import { useContractor, useUpdateContractor, useDeleteContractor } from '@/hooks/useContractors';
 import { useContractorJobs } from '@/hooks/useContractorJobs';
import { useContractorReviews } from '@/hooks/useContractors';
 import { toast } from 'sonner';
import { AddReviewDialog } from './AddReviewDialog';
 import { EditContractorForm } from './EditContractorForm';
 import { format } from 'date-fns';
 import { cn } from '@/lib/utils';
 
 interface ContractorDetailDrawerProps {
   contractorId: string | null;
   open: boolean;
   onOpenChange: (open: boolean) => void;
 }
 
 export function ContractorDetailDrawer({ contractorId, open, onOpenChange }: ContractorDetailDrawerProps) {
   const [isEditing, setIsEditing] = useState(false);
   const [showReviewDialog, setShowReviewDialog] = useState(false);
   
   const { data: contractor, isLoading } = useContractor(contractorId || undefined);
   const { data: jobsData } = useContractorJobs({ contractorId: contractorId || undefined });
   const jobs = jobsData?.items;
   const { data: reviews } = useContractorReviews(contractorId || undefined);
   const updateContractor = useUpdateContractor();
   const deleteContractor = useDeleteContractor();
 
   const handleTogglePreferred = async () => {
     if (!contractor) return;
     try {
       await updateContractor.mutateAsync({
         id: contractor.id,
         is_preferred: !contractor.is_preferred,
       });
     } catch (err) {
       toast.error(err instanceof Error ? err.message : 'Failed to update contractor');
     }
   };
 
   const handleDelete = async () => {
     if (!contractor) return;
     if (!confirm('Are you sure you want to delete this contractor?')) return;
     try {
       await deleteContractor.mutateAsync(contractor.id);
       onOpenChange(false);
     } catch (err) {
       toast.error(err instanceof Error ? err.message : 'Failed to delete contractor');
     }
   };
 
   if (isLoading || !contractor) {
     return (
       <Sheet open={open} onOpenChange={onOpenChange}>
         <SheetContent className="w-full sm:max-w-lg">
           <div className="flex items-center justify-center h-64">
             <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
           </div>
         </SheetContent>
       </Sheet>
     );
   }
 
   const completedJobs = jobs?.filter(j => j.status === 'completed' || j.status === 'verified') || [];
   const activeJobs = jobs?.filter(j => !['completed', 'verified', 'cancelled'].includes(j.status)) || [];
 
   return (
     <>
       <Sheet open={open} onOpenChange={onOpenChange}>
         <SheetContent className="w-full sm:max-w-lg p-0">
           <SheetHeader className="p-6 pb-4 border-b">
             <div className="flex items-start justify-between">
               <div>
                 <SheetTitle className="flex items-center gap-2">
                   {contractor.name}
                   {contractor.is_preferred && (
                     <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                   )}
                 </SheetTitle>
                 {contractor.company_name && (
                   <SheetDescription>{contractor.company_name}</SheetDescription>
                 )}
               </div>
               <div className="flex items-center gap-2">
                 <Button
                   variant="ghost"
                   size="icon"
                   onClick={() => setIsEditing(!isEditing)}
                 >
                   {isEditing ? <X className="h-4 w-4" /> : <Edit2 className="h-4 w-4" />}
                 </Button>
               </div>
             </div>
           </SheetHeader>
 
           {isEditing ? (
             <div className="p-6">
               <EditContractorForm
                 contractor={contractor}
                 onSave={() => setIsEditing(false)}
                 onCancel={() => setIsEditing(false)}
               />
             </div>
           ) : (
             <Tabs defaultValue="overview" className="flex-1">
               <TabsList className="w-full justify-start rounded-none border-b px-6 h-auto py-0">
                 <TabsTrigger value="overview" className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary py-3">
                   Overview
                 </TabsTrigger>
                 <TabsTrigger value="jobs" className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary py-3">
                   Jobs ({jobs?.length || 0})
                 </TabsTrigger>
                 <TabsTrigger value="reviews" className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary py-3">
                   Reviews ({reviews?.length || 0})
                 </TabsTrigger>
               </TabsList>
 
               <ScrollArea className="h-[calc(100vh-200px)]">
                 <TabsContent value="overview" className="p-6 space-y-6 mt-0">
                   {/* Contact Info */}
                   <div className="space-y-3">
                     <h3 className="text-sm font-medium text-muted-foreground">Contact</h3>
                     <div className="space-y-2">
                       {contractor.phone && (
                         <a href={`tel:${contractor.phone}`} className="flex items-center gap-2 text-sm hover:text-primary">
                           <Phone className="h-4 w-4 text-muted-foreground" />
                           {contractor.phone}
                         </a>
                       )}
                       {contractor.email && (
                         <a href={`mailto:${contractor.email}`} className="flex items-center gap-2 text-sm hover:text-primary">
                           <Mail className="h-4 w-4 text-muted-foreground" />
                           {contractor.email}
                         </a>
                       )}
                       {contractor.website && (
                         <a href={contractor.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm hover:text-primary">
                           <Globe className="h-4 w-4 text-muted-foreground" />
                           {contractor.website}
                         </a>
                       )}
                     </div>
                   </div>
 
                   <Separator />
 
                   {/* Stats */}
                   <div className="grid grid-cols-3 gap-4">
                     <div className="text-center">
                       <div className="text-2xl font-bold">{contractor.total_jobs || 0}</div>
                       <div className="text-xs text-muted-foreground">Jobs</div>
                     </div>
                     <div className="text-center">
                       <div className="flex items-center justify-center gap-1 text-2xl font-bold">
                         {contractor.average_rating ? contractor.average_rating.toFixed(1) : '-'}
                         <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                       </div>
                       <div className="text-xs text-muted-foreground">Rating</div>
                     </div>
                     <div className="text-center">
                       <div className="text-2xl font-bold">
                         {contractor.avg_response_hours ? `${contractor.avg_response_hours}h` : '-'}
                       </div>
                       <div className="text-xs text-muted-foreground">Avg Response</div>
                     </div>
                   </div>
 
                   <Separator />
 
                   {/* Services */}
                   <div className="space-y-3">
                     <h3 className="text-sm font-medium text-muted-foreground">Services</h3>
                     <div className="flex flex-wrap gap-2">
                       {contractor.compliance_types?.length ? (
                         contractor.compliance_types.map((type: string) => (
                           <Badge key={type} variant="secondary">
                             {type.split('(')[0].trim()}
                           </Badge>
                         ))
                       ) : (
                         <span className="text-sm text-muted-foreground">No services specified</span>
                       )}
                     </div>
                   </div>
 
                   {/* Service Areas */}
                   {contractor.service_areas?.length > 0 && (
                     <>
                       <Separator />
                       <div className="space-y-3">
                         <h3 className="text-sm font-medium text-muted-foreground">Service Areas</h3>
                         <div className="flex flex-wrap gap-2">
                           {contractor.service_areas.map((area: string) => (
                             <Badge key={area} variant="outline">
                               <MapPin className="h-3 w-3 mr-1" />
                               {area}
                             </Badge>
                           ))}
                         </div>
                       </div>
                     </>
                   )}
 
                   {/* Pricing */}
                   {(contractor.hourly_rate_gbp || contractor.call_out_fee_gbp) && (
                     <>
                       <Separator />
                       <div className="space-y-3">
                         <h3 className="text-sm font-medium text-muted-foreground">Pricing</h3>
                         <div className="grid grid-cols-2 gap-4">
                           {contractor.hourly_rate_gbp && (
                             <div>
                               <div className="text-lg font-semibold">£{contractor.hourly_rate_gbp}</div>
                               <div className="text-xs text-muted-foreground">per hour</div>
                             </div>
                           )}
                           {contractor.call_out_fee_gbp && (
                             <div>
                               <div className="text-lg font-semibold">£{contractor.call_out_fee_gbp}</div>
                               <div className="text-xs text-muted-foreground">call-out fee</div>
                             </div>
                           )}
                         </div>
                       </div>
                     </>
                   )}
 
                   {/* Notes */}
                   {contractor.notes && (
                     <>
                       <Separator />
                       <div className="space-y-3">
                         <h3 className="text-sm font-medium text-muted-foreground">Notes</h3>
                         <p className="text-sm">{contractor.notes}</p>
                       </div>
                     </>
                   )}
 
                   {/* Actions */}
                   <Separator />
                   <div className="flex flex-col gap-2">
                     <Button
                       variant="outline"
                       onClick={handleTogglePreferred}
                       className="w-full"
                     >
                       <Star className={cn(
                         "h-4 w-4 mr-2",
                         contractor.is_preferred && "fill-amber-400 text-amber-400"
                       )} />
                       {contractor.is_preferred ? 'Remove from Preferred' : 'Mark as Preferred'}
                     </Button>
                     <Button
                       variant="destructive"
                       onClick={handleDelete}
                       className="w-full"
                     >
                       Delete Contractor
                     </Button>
                   </div>
                 </TabsContent>
 
                 <TabsContent value="jobs" className="p-6 space-y-4 mt-0">
                   {activeJobs.length > 0 && (
                     <div className="space-y-3">
                       <h3 className="text-sm font-medium">Active Jobs</h3>
                       {activeJobs.map(job => (
                         <Card key={job.id}>
                           <CardContent className="p-3">
                             <div className="flex items-start justify-between">
                               <div>
                                 <p className="font-medium text-sm">{job.job_type}</p>
                                 <p className="text-xs text-muted-foreground">{job.property?.address_line}</p>
                               </div>
                               <Badge variant="secondary" className="text-xs">
                                 {job.status}
                               </Badge>
                             </div>
                           </CardContent>
                         </Card>
                       ))}
                     </div>
                   )}
 
                   {completedJobs.length > 0 && (
                     <div className="space-y-3">
                       <h3 className="text-sm font-medium">Completed Jobs</h3>
                       {completedJobs.map(job => (
                         <Card key={job.id}>
                           <CardContent className="p-3">
                             <div className="flex items-start justify-between">
                               <div>
                                 <p className="font-medium text-sm">{job.job_type}</p>
                                 <p className="text-xs text-muted-foreground">{job.property?.address_line}</p>
                                 {job.completed_at && (
                                   <p className="text-xs text-muted-foreground mt-1">
                                     Completed {format(new Date(job.completed_at), 'dd MMM yyyy')}
                                   </p>
                                 )}
                               </div>
                               <CheckCircle className="h-4 w-4 text-emerald-500" />
                             </div>
                           </CardContent>
                         </Card>
                       ))}
                     </div>
                   )}
 
                   {jobs?.length === 0 && (
                     <div className="text-center py-8 text-muted-foreground">
                       <Briefcase className="h-12 w-12 mx-auto mb-3 opacity-20" />
                       <p>No jobs with this contractor yet</p>
                     </div>
                   )}
                 </TabsContent>
 
                 <TabsContent value="reviews" className="p-6 space-y-4 mt-0">
                   <Button onClick={() => setShowReviewDialog(true)} className="w-full">
                     <MessageSquare className="h-4 w-4 mr-2" />
                     Add Review
                   </Button>
 
                   {reviews?.length ? (
                     <div className="space-y-4">
                       {reviews.map(review => (
                         <Card key={review.id}>
                           <CardContent className="p-4">
                             <div className="flex items-center gap-2 mb-2">
                               {[1, 2, 3, 4, 5].map(star => (
                                 <Star
                                   key={star}
                                   className={cn(
                                     "h-4 w-4",
                                     star <= review.rating
                                       ? "fill-amber-400 text-amber-400"
                                       : "text-muted-foreground"
                                   )}
                                 />
                               ))}
                               <span className="text-sm text-muted-foreground ml-2">
                                 {format(new Date(review.created_at), 'dd MMM yyyy')}
                               </span>
                             </div>
                             {review.review_text && (
                               <p className="text-sm">{review.review_text}</p>
                             )}
                             {/* Sub-ratings */}
                             <div className="flex flex-wrap gap-2 mt-3">
                               {review.punctuality_rating && (
                                 <Badge variant="outline" className="text-xs">
                                   <Clock className="h-3 w-3 mr-1" />
                                   Punctuality: {review.punctuality_rating}/5
                                 </Badge>
                               )}
                               {review.quality_rating && (
                                 <Badge variant="outline" className="text-xs">
                                   Quality: {review.quality_rating}/5
                                 </Badge>
                               )}
                               {review.value_rating && (
                                 <Badge variant="outline" className="text-xs">
                                   Value: {review.value_rating}/5
                                 </Badge>
                               )}
                               {review.communication_rating && (
                                 <Badge variant="outline" className="text-xs">
                                   Communication: {review.communication_rating}/5
                                 </Badge>
                               )}
                             </div>
                           </CardContent>
                         </Card>
                       ))}
                     </div>
                   ) : (
                     <div className="text-center py-8 text-muted-foreground">
                       <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-20" />
                       <p>No reviews yet</p>
                     </div>
                   )}
                 </TabsContent>
               </ScrollArea>
             </Tabs>
           )}
         </SheetContent>
       </Sheet>
 
       <AddReviewDialog
         contractorId={contractorId}
         open={showReviewDialog}
         onOpenChange={setShowReviewDialog}
       />
     </>
   );
 }