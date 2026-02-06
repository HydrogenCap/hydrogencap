import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Briefcase, Calendar, Clock, CheckCircle, Send, Phone, Mail, MapPin, MessageSquare, Loader2, AlertCircle, Zap, AlertTriangle, Plus, Copy, Inbox } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useContractorJob, useUpdateJob, useSendJobRequest, useBookJob, useCompleteJob, JOB_PRIORITIES } from '@/hooks/useContractorJobs';
import { useJobNotes, useAddJobNote } from '@/hooks/useJobNotes';
import { AddReviewDialog } from '@/components/contractors/AddReviewDialog';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
 
 const STATUS_CONFIG: Record<string, { label: string; color: string; description: string }> = {
   draft: { label: 'Draft', color: 'bg-muted text-muted-foreground', description: 'Job created but not sent' },
   requested: { label: 'Awaiting Quote', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', description: 'Waiting for contractor response' },
   quoted: { label: 'Quote Received', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400', description: 'Review and accept the quote' },
   accepted: { label: 'Accepted', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400', description: 'Quote accepted, book a date' },
   booked: { label: 'Booked', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', description: 'Date confirmed with contractor' },
   in_progress: { label: 'In Progress', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', description: 'Work is underway' },
   completed: { label: 'Completed', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', description: 'Work done, upload certificate' },
   verified: { label: 'Verified', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', description: 'Certificate uploaded and verified' },
   cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', description: 'Job was cancelled' },
 };
 
 export default function JobDetail() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: job, isLoading } = useContractorJob(jobId);
  const { data: notes } = useJobNotes(jobId);
  const addNote = useAddJobNote();
   
   const [showBookDialog, setShowBookDialog] = useState(false);
   const [showCompleteDialog, setShowCompleteDialog] = useState(false);
   const [showReviewDialog, setShowReviewDialog] = useState(false);
   const [bookingDate, setBookingDate] = useState('');
   const [bookingTime, setBookingTime] = useState('');
   const [quotedAmount, setQuotedAmount] = useState('');
   const [finalAmount, setFinalAmount] = useState('');
   const [completionNotes, setCompletionNotes] = useState('');
  const [newNote, setNewNote] = useState('');
 
   const updateJob = useUpdateJob();
   const sendRequest = useSendJobRequest();
   const bookJob = useBookJob();
   const completeJob = useCompleteJob();
 
  const handleAddNote = async () => {
    if (!newNote.trim() || !job) return;
    await addNote.mutateAsync({
      jobId: job.id,
      note: newNote,
    });
    setNewNote('');
  };

  if (isLoading) {
     return (
       <AppLayout>
         <div className="flex items-center justify-center h-64">
           <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
         </div>
       </AppLayout>
     );
   }
 
   if (!job) {
     return (
       <AppLayout>
         <div className="text-center py-12">
           <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
           <h2 className="text-xl font-semibold mb-2">Job not found</h2>
           <Button onClick={() => navigate('/jobs')}>Back to Jobs</Button>
         </div>
       </AppLayout>
     );
   }
 
   const config = STATUS_CONFIG[job.status] || STATUS_CONFIG.draft;
  const priorityConfig = JOB_PRIORITIES.find(p => p.value === job.priority);

  // Calculate days until expiry if compliance linked
  const daysUntilExpiry = job.compliance_item?.expiry_date
    ? Math.ceil((new Date(job.compliance_item.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;
 
   const handleSendRequest = async () => {
     await sendRequest.mutateAsync({ jobId: job.id });
   };
 
   const handleRecordQuote = async () => {
     await updateJob.mutateAsync({
       id: job.id,
       status: 'quoted',
       quoted_at: new Date().toISOString(),
       quoted_amount_gbp: quotedAmount ? parseInt(quotedAmount) : null,
     });
   };
 
   const handleAcceptQuote = async () => {
     await updateJob.mutateAsync({
       id: job.id,
       status: 'accepted',
       accepted_at: new Date().toISOString(),
     });
   };
 
   const handleBookJob = async () => {
     if (!bookingDate) return;
     await bookJob.mutateAsync({
       jobId: job.id,
       bookedDate: bookingDate,
       bookedTimeSlot: bookingTime || undefined,
       quotedAmount: quotedAmount ? parseInt(quotedAmount) : undefined,
     });
     setShowBookDialog(false);
   };
 
   const handleStartWork = async () => {
     await updateJob.mutateAsync({
       id: job.id,
       status: 'in_progress',
     });
   };
 
   const handleCompleteJob = async () => {
     await completeJob.mutateAsync({
       jobId: job.id,
       finalAmount: finalAmount ? parseInt(finalAmount) : undefined,
       notes: completionNotes || undefined,
     });
     setShowCompleteDialog(false);
     setShowReviewDialog(true);
   };
 
   const handleVerify = async () => {
     await updateJob.mutateAsync({
       id: job.id,
       status: 'verified',
     });
   };
 
   const handleCancel = async () => {
     if (!confirm('Are you sure you want to cancel this job?')) return;
     await updateJob.mutateAsync({
       id: job.id,
       status: 'cancelled',
     });
   };
 
   return (
     <AppLayout>
       <div className="space-y-6">
         {/* Header */}
         <div className="flex items-start justify-between">
           <div>
             <Button variant="ghost" size="sm" onClick={() => navigate('/jobs')} className="mb-2 -ml-2">
               <ArrowLeft className="h-4 w-4 mr-1" />
               Back to Jobs
             </Button>
             <div className="flex items-center gap-3">
               <h1 className="text-2xl font-bold">{job.job_type}</h1>
               <Badge className={cn('text-sm', config.color)}>{config.label}</Badge>
              {job.priority !== 'normal' && (
                <Badge className={cn('text-sm', priorityConfig?.color)}>
                  {job.priority === 'urgent' && <AlertTriangle className="h-3 w-3 mr-1" />}
                  {priorityConfig?.label}
                </Badge>
              )}
              {job.source === 'auto_compliance' && (
                <Badge variant="outline" className="text-sm">
                  <Zap className="h-3 w-3 mr-1" />
                  Auto-created
                </Badge>
              )}
             </div>
             <p className="text-muted-foreground mt-1">{config.description}</p>
            {daysUntilExpiry !== null && daysUntilExpiry > 0 && (
              <p className={cn(
                "text-sm mt-2",
                daysUntilExpiry <= 14 ? "text-red-600 dark:text-red-400" :
                daysUntilExpiry <= 30 ? "text-amber-600 dark:text-amber-400" :
                "text-muted-foreground"
              )}>
                Compliance expires in {daysUntilExpiry} days
              </p>
            )}
           </div>
         </div>
 
         <div className="grid gap-6 lg:grid-cols-3">
           {/* Main Content */}
           <div className="lg:col-span-2 space-y-6">
             {/* Property */}
             <Card>
               <CardHeader className="pb-3">
                 <CardTitle className="text-base flex items-center gap-2">
                   <MapPin className="h-4 w-4" />
                   Property
                 </CardTitle>
               </CardHeader>
               <CardContent>
                 <Link to={`/properties/${job.property_id}`} className="hover:text-primary">
                   <p className="font-medium">{job.property?.address_line}</p>
                   <p className="text-sm text-muted-foreground">{job.property?.postcode}</p>
                 </Link>
               </CardContent>
             </Card>
 
             {/* Contractor */}
             {job.contractor && (
               <Card>
                 <CardHeader className="pb-3">
                   <CardTitle className="text-base flex items-center gap-2">
                     <Briefcase className="h-4 w-4" />
                     Contractor
                   </CardTitle>
                 </CardHeader>
                 <CardContent>
                   <p className="font-medium">{job.contractor.name}</p>
                   {job.contractor.company_name && (
                     <p className="text-sm text-muted-foreground">{job.contractor.company_name}</p>
                   )}
                   <div className="flex items-center gap-4 mt-3">
                     {job.contractor.phone && (
                       <a href={`tel:${job.contractor.phone}`} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
                         <Phone className="h-3 w-3" />
                         {job.contractor.phone}
                       </a>
                     )}
                     {job.contractor.email && (
                       <a href={`mailto:${job.contractor.email}`} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
                         <Mail className="h-3 w-3" />
                         {job.contractor.email}
                       </a>
                     )}
                   </div>
                 </CardContent>
               </Card>
             )}
 
             {/* Timeline */}
             <Card>
               <CardHeader className="pb-3">
                 <CardTitle className="text-base">Timeline</CardTitle>
               </CardHeader>
               <CardContent>
                 <div className="space-y-4">
                   <div className="flex items-center gap-3">
                     <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                       <Briefcase className="h-4 w-4" />
                     </div>
                     <div>
                       <p className="text-sm font-medium">Created</p>
                       <p className="text-xs text-muted-foreground">
                         {format(new Date(job.created_at), 'dd MMM yyyy HH:mm')}
                       </p>
                     </div>
                   </div>
 
                   {job.requested_at && (
                     <div className="flex items-center gap-3">
                       <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                         <Send className="h-4 w-4 text-blue-600" />
                       </div>
                       <div>
                         <p className="text-sm font-medium">Request Sent</p>
                         <p className="text-xs text-muted-foreground">
                           {format(new Date(job.requested_at), 'dd MMM yyyy HH:mm')}
                         </p>
                       </div>
                     </div>
                   )}
 
                   {job.quoted_at && (
                     <div className="flex items-center gap-3">
                       <div className="h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                         <MessageSquare className="h-4 w-4 text-purple-600" />
                       </div>
                       <div>
                         <p className="text-sm font-medium">Quote Received</p>
                         <p className="text-xs text-muted-foreground">
                           {format(new Date(job.quoted_at), 'dd MMM yyyy HH:mm')}
                           {job.quoted_amount_gbp && ` • £${job.quoted_amount_gbp}`}
                         </p>
                       </div>
                     </div>
                   )}
 
                   {job.booked_date && (
                     <div className="flex items-center gap-3">
                       <div className="h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                         <Calendar className="h-4 w-4 text-amber-600" />
                       </div>
                       <div>
                         <p className="text-sm font-medium">Booked</p>
                         <p className="text-xs text-muted-foreground">
                           {format(new Date(job.booked_date), 'dd MMM yyyy')}
                           {job.booked_time_slot && ` • ${job.booked_time_slot}`}
                         </p>
                       </div>
                     </div>
                   )}
 
                   {job.completed_at && (
                     <div className="flex items-center gap-3">
                       <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                         <CheckCircle className="h-4 w-4 text-emerald-600" />
                       </div>
                       <div>
                         <p className="text-sm font-medium">Completed</p>
                         <p className="text-xs text-muted-foreground">
                           {format(new Date(job.completed_at), 'dd MMM yyyy HH:mm')}
                           {job.final_amount_gbp && ` • £${job.final_amount_gbp}`}
                         </p>
                       </div>
                     </div>
                   )}
                 </div>
               </CardContent>
             </Card>
           </div>
 
           {/* Actions Sidebar */}
           <div className="space-y-6">
             <Card>
               <CardHeader className="pb-3">
                 <CardTitle className="text-base">Actions</CardTitle>
               </CardHeader>
               <CardContent className="space-y-3">
                 {/* Draft - Send Request */}
                 {job.status === 'draft' && job.contractor && (
                   <Button
                     onClick={handleSendRequest}
                     disabled={sendRequest.isPending}
                     className="w-full"
                   >
                     {sendRequest.isPending ? (
                       <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending...</>
                     ) : (
                       <><Send className="h-4 w-4 mr-2" />Send Request</>
                     )}
                   </Button>
                 )}
 
                 {/* Requested - Record Quote */}
                 {job.status === 'requested' && (
                   <div className="space-y-3">
                     <div className="space-y-2">
                       <Label>Quote Amount (£)</Label>
                       <Input
                         type="number"
                         value={quotedAmount}
                         onChange={(e) => setQuotedAmount(e.target.value)}
                         placeholder="Enter quote amount"
                       />
                     </div>
                     <Button
                       onClick={handleRecordQuote}
                       disabled={updateJob.isPending}
                       className="w-full"
                     >
                       Record Quote
                     </Button>
                   </div>
                 )}
 
                 {/* Quoted - Accept & Book */}
                 {job.status === 'quoted' && (
                   <>
                     <Button onClick={handleAcceptQuote} className="w-full">
                       Accept Quote
                     </Button>
                     <Button onClick={() => setShowBookDialog(true)} variant="outline" className="w-full">
                       <Calendar className="h-4 w-4 mr-2" />
                       Book Date
                     </Button>
                   </>
                 )}
 
                 {/* Accepted - Book */}
                 {job.status === 'accepted' && (
                   <Button onClick={() => setShowBookDialog(true)} className="w-full">
                     <Calendar className="h-4 w-4 mr-2" />
                     Book Date
                   </Button>
                 )}
 
                 {/* Booked - Start Work */}
                 {job.status === 'booked' && (
                   <Button onClick={handleStartWork} className="w-full">
                     Start Work
                   </Button>
                 )}
 
                 {/* In Progress - Complete */}
                 {job.status === 'in_progress' && (
                   <Button onClick={() => setShowCompleteDialog(true)} className="w-full">
                     <CheckCircle className="h-4 w-4 mr-2" />
                     Mark Complete
                   </Button>
                 )}
 
                 {/* Completed - Verify */}
                 {job.status === 'completed' && (
                   <>
                     <Button onClick={handleVerify} className="w-full">
                       <CheckCircle className="h-4 w-4 mr-2" />
                       Verify & Close
                     </Button>
                     <Button onClick={() => setShowReviewDialog(true)} variant="outline" className="w-full">
                       <MessageSquare className="h-4 w-4 mr-2" />
                       Add Review
                     </Button>
                   </>
                 )}
 
                 {/* Cancel button for active jobs */}
                 {!['completed', 'verified', 'cancelled'].includes(job.status) && (
                   <Button onClick={handleCancel} variant="destructive" className="w-full">
                     Cancel Job
                   </Button>
                 )}
               </CardContent>
             </Card>
 
             {/* Financials */}
             {(job.quoted_amount_gbp || job.final_amount_gbp) && (
               <Card>
                 <CardHeader className="pb-3">
                   <CardTitle className="text-base">Financials</CardTitle>
                 </CardHeader>
                 <CardContent className="space-y-2">
                   {job.quoted_amount_gbp && (
                     <div className="flex justify-between">
                       <span className="text-sm text-muted-foreground">Quote</span>
                       <span className="font-medium">£{job.quoted_amount_gbp}</span>
                     </div>
                   )}
                   {job.final_amount_gbp && (
                     <div className="flex justify-between">
                       <span className="text-sm text-muted-foreground">Final</span>
                       <span className="font-medium">£{job.final_amount_gbp}</span>
                     </div>
                   )}
                   <Separator />
                   <div className="flex justify-between">
                     <span className="text-sm text-muted-foreground">Payment</span>
                     <Badge variant="outline">{job.payment_status}</Badge>
                   </div>
                 </CardContent>
               </Card>
             )}

            {/* Notes */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Add Note */}
                <div className="flex gap-2 mb-4">
                  <Textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Add a note..."
                    rows={2}
                    className="flex-1"
                  />
                  <Button 
                    onClick={handleAddNote} 
                    disabled={!newNote.trim() || addNote.isPending}
                    size="sm"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {/* Notes List */}
                <div className="space-y-3">
                  {notes?.map(note => (
                    <div key={note.id} className="p-3 bg-muted rounded-lg">
                      <p className="text-sm">{note.note}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(note.created_at), 'dd MMM yyyy, HH:mm')}
                      </p>
                    </div>
                  ))}
                  {(!notes || notes.length === 0) && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No notes yet
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Certificate Inbox Email */}
            {job.inbox_email && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Inbox className="h-4 w-4" />
                    Certificate Inbox
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-2">
                    Contractor can email certificates directly to:
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-muted px-3 py-2 rounded text-xs font-mono truncate">
                      {job.inbox_email}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(job.inbox_email!);
                        toast({ title: 'Email copied to clipboard' });
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Certificates sent here will be automatically processed and filed.
                  </p>

                  {/* Certificate status for completed jobs */}
                  {job.status === 'completed' && (
                    <div className={cn(
                      "mt-3 p-2 rounded-lg flex items-center gap-2 text-sm",
                      job.certificate_received 
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                        : "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                    )}>
                      {job.certificate_received ? (
                        <>
                          <CheckCircle className="h-4 w-4" />
                          Certificate received {job.certificate_received_at && format(new Date(job.certificate_received_at), 'dd MMM')}
                        </>
                      ) : (
                        <>
                          <Clock className="h-4 w-4" />
                          Awaiting certificate
                        </>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
           </div>
         </div>
       </div>
       {/* Book Dialog */}
       <Dialog open={showBookDialog} onOpenChange={setShowBookDialog}>
         <DialogContent>
           <DialogHeader>
             <DialogTitle>Book Job</DialogTitle>
             <DialogDescription>Schedule a date for this work</DialogDescription>
           </DialogHeader>
           <div className="space-y-4 py-4">
             <div className="space-y-2">
               <Label>Date *</Label>
               <Input
                 type="date"
                 value={bookingDate}
                 onChange={(e) => setBookingDate(e.target.value)}
               />
             </div>
             <div className="space-y-2">
               <Label>Time Slot</Label>
               <Input
                 value={bookingTime}
                 onChange={(e) => setBookingTime(e.target.value)}
                 placeholder="e.g., Morning, 9am-12pm"
               />
             </div>
           </div>
           <DialogFooter>
             <Button variant="outline" onClick={() => setShowBookDialog(false)}>Cancel</Button>
             <Button onClick={handleBookJob} disabled={!bookingDate || bookJob.isPending}>
               {bookJob.isPending ? 'Booking...' : 'Confirm Booking'}
             </Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>
 
       {/* Complete Dialog */}
       <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
         <DialogContent>
           <DialogHeader>
             <DialogTitle>Mark Job Complete</DialogTitle>
             <DialogDescription>Record completion details</DialogDescription>
           </DialogHeader>
           <div className="space-y-4 py-4">
             <div className="space-y-2">
               <Label>Final Amount (£)</Label>
               <Input
                 type="number"
                 value={finalAmount}
                 onChange={(e) => setFinalAmount(e.target.value)}
                 placeholder={job.quoted_amount_gbp?.toString() || 'Enter amount'}
               />
             </div>
             <div className="space-y-2">
               <Label>Notes</Label>
               <Textarea
                 value={completionNotes}
                 onChange={(e) => setCompletionNotes(e.target.value)}
                 placeholder="Any notes about the work..."
                 rows={3}
               />
             </div>
           </div>
           <DialogFooter>
             <Button variant="outline" onClick={() => setShowCompleteDialog(false)}>Cancel</Button>
             <Button onClick={handleCompleteJob} disabled={completeJob.isPending}>
               {completeJob.isPending ? 'Completing...' : 'Complete Job'}
             </Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>
 
       {/* Review Dialog */}
       <AddReviewDialog
         contractorId={job.contractor_id}
         jobId={job.id}
         open={showReviewDialog}
         onOpenChange={setShowReviewDialog}
       />
     </AppLayout>
   );
 }