import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useContractorJob, useUpdateJob, useSendJobRequest, useBookJob, useCompleteJob } from '@/hooks/useContractorJobs';
import { useJobNotes, useAddJobNote } from '@/hooks/useJobNotes';

export function useJobDetailState() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
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
    await addNote.mutateAsync({ jobId: job.id, note: newNote });
    setNewNote('');
  };

  const handleSendRequest = async () => {
    if (!job) return;
    await sendRequest.mutateAsync({ jobId: job.id });
  };

  const handleRecordQuote = async () => {
    if (!job) return;
    await updateJob.mutateAsync({
      id: job.id,
      status: 'quoted',
      quoted_at: new Date().toISOString(),
      quoted_amount_gbp: quotedAmount ? parseInt(quotedAmount) : null,
    });
  };

  const handleAcceptQuote = async () => {
    if (!job) return;
    await updateJob.mutateAsync({
      id: job.id,
      status: 'accepted',
      accepted_at: new Date().toISOString(),
    });
  };

  const handleBookJob = async () => {
    if (!job || !bookingDate) return;
    await bookJob.mutateAsync({
      jobId: job.id,
      bookedDate: bookingDate,
      bookedTimeSlot: bookingTime || undefined,
      quotedAmount: quotedAmount ? parseInt(quotedAmount) : undefined,
    });
    setShowBookDialog(false);
  };

  const handleStartWork = async () => {
    if (!job) return;
    await updateJob.mutateAsync({ id: job.id, status: 'in_progress' });
  };

  const handleCompleteJob = async () => {
    if (!job) return;
    await completeJob.mutateAsync({
      jobId: job.id,
      finalAmount: finalAmount ? parseInt(finalAmount) : undefined,
      notes: completionNotes || undefined,
    });
    setShowCompleteDialog(false);
    setShowReviewDialog(true);
  };

  const handleVerify = async () => {
    if (!job) return;
    await updateJob.mutateAsync({ id: job.id, status: 'verified' });
  };

  const handleCancel = async () => {
    if (!job) return;
    if (!confirm('Are you sure you want to cancel this job?')) return;
    await updateJob.mutateAsync({ id: job.id, status: 'cancelled' });
  };

  return {
    jobId, navigate, job, isLoading, notes, addNote,
    showBookDialog, setShowBookDialog,
    showCompleteDialog, setShowCompleteDialog,
    showReviewDialog, setShowReviewDialog,
    bookingDate, setBookingDate,
    bookingTime, setBookingTime,
    quotedAmount, setQuotedAmount,
    finalAmount, setFinalAmount,
    completionNotes, setCompletionNotes,
    newNote, setNewNote,
    updateJob, sendRequest, bookJob, completeJob,
    handleAddNote, handleSendRequest, handleRecordQuote, handleAcceptQuote,
    handleBookJob, handleStartWork, handleCompleteJob, handleVerify, handleCancel,
  };
}
