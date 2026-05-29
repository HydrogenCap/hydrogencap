import { format } from 'date-fns';
import { Inbox, Copy, CheckCircle, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from "sonner";

interface Job {
  inbox_email?: string | null;
  status: string;
  certificate_received?: boolean | null;
  certificate_received_at?: string | null;
}

export function CertificateInboxCard({ job }: { job: Job }) {
  if (!job.inbox_email) return null;
  return (
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
              toast.success('Email copied to clipboard');
            }}
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Certificates sent here will be automatically processed and filed.
        </p>

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
  );
}
