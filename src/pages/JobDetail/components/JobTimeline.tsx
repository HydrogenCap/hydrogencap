import { format } from 'date-fns';
import { Briefcase, Send, MessageSquare, Calendar, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Job {
  created_at: string;
  requested_at?: string | null;
  quoted_at?: string | null;
  quoted_amount_gbp?: number | null;
  booked_date?: string | null;
  booked_time_slot?: string | null;
  completed_at?: string | null;
  final_amount_gbp?: number | null;
}

export function JobTimeline({ job }: { job: Job }) {
  return (
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
  );
}
