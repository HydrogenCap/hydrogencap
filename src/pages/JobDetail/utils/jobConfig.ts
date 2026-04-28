export const STATUS_CONFIG: Record<string, { label: string; color: string; description: string }> = {
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
