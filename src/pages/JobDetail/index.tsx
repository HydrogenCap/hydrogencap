import { Loader2, AlertCircle } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { AddReviewDialog } from '@/components/contractors/AddReviewDialog';
import { useJobDetailState } from './hooks/useJobDetailState';
import { JobHeader } from './components/JobHeader';
import { PropertyAndContractorCards } from './components/PropertyAndContractorCards';
import { JobTimeline } from './components/JobTimeline';
import { ActionsSidebar } from './components/ActionsSidebar';
import { FinancialsCard } from './components/FinancialsCard';
import { NotesCard } from './components/NotesCard';
import { CertificateInboxCard } from './components/CertificateInboxCard';
import { BookDialog, CompleteDialog } from './components/JobDialogs';

export default function JobDetail() {
  const s = useJobDetailState();

  if (s.isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!s.job) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">Job not found</h2>
          <Button onClick={() => s.navigate('/jobs')}>Back to Jobs</Button>
        </div>
      </AppLayout>
    );
  }

  const job = s.job;

  return (
    <AppLayout>
      <div className="space-y-6">
        <JobHeader job={job} onBack={() => s.navigate('/jobs')} />

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <PropertyAndContractorCards job={job} />
            <JobTimeline job={job} />
          </div>

          <div className="space-y-6">
            <ActionsSidebar
              job={job}
              quotedAmount={s.quotedAmount}
              setQuotedAmount={s.setQuotedAmount}
              sendRequest={s.sendRequest}
              updateJob={s.updateJob}
              handleSendRequest={s.handleSendRequest}
              handleRecordQuote={s.handleRecordQuote}
              handleAcceptQuote={s.handleAcceptQuote}
              setShowBookDialog={s.setShowBookDialog}
              handleStartWork={s.handleStartWork}
              setShowCompleteDialog={s.setShowCompleteDialog}
              handleVerify={s.handleVerify}
              setShowReviewDialog={s.setShowReviewDialog}
              handleCancel={s.handleCancel}
            />
            <FinancialsCard job={job} />
            <NotesCard
              notes={s.notes}
              newNote={s.newNote}
              setNewNote={s.setNewNote}
              addNote={s.addNote}
              handleAddNote={s.handleAddNote}
            />
            <CertificateInboxCard job={job} />
          </div>
        </div>
      </div>

      <BookDialog
        open={s.showBookDialog}
        onOpenChange={s.setShowBookDialog}
        bookingDate={s.bookingDate}
        setBookingDate={s.setBookingDate}
        bookingTime={s.bookingTime}
        setBookingTime={s.setBookingTime}
        handleBookJob={s.handleBookJob}
        isPending={s.bookJob.isPending}
      />

      <CompleteDialog
        open={s.showCompleteDialog}
        onOpenChange={s.setShowCompleteDialog}
        finalAmount={s.finalAmount}
        setFinalAmount={s.setFinalAmount}
        completionNotes={s.completionNotes}
        setCompletionNotes={s.setCompletionNotes}
        handleCompleteJob={s.handleCompleteJob}
        isPending={s.completeJob.isPending}
        quotedAmountPlaceholder={job.quoted_amount_gbp?.toString() || ''}
      />

      <AddReviewDialog
        contractorId={job.contractor_id}
        jobId={job.id}
        open={s.showReviewDialog}
        onOpenChange={s.setShowReviewDialog}
      />
    </AppLayout>
  );
}
