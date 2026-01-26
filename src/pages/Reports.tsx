import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useScheduledEmailRuns, useSendTestEmail, usePreviewEmail } from '@/hooks/useScheduledEmailRuns';
import { Mail, RefreshCw, Eye, Send, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function Reports() {
  const { data: emailRuns, isLoading, refetch } = useScheduledEmailRuns(12);
  const sendTestEmail = useSendTestEmail();
  const previewEmail = usePreviewEmail();
  
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewSubject, setPreviewSubject] = useState('');

  const handleSendTest = async () => {
    try {
      await sendTestEmail.mutateAsync();
      toast.success('Test email sent successfully to office@oxygen.rocks');
    } catch (error) {
      toast.error(`Failed to send test email: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handlePreview = async () => {
    try {
      const result = await previewEmail.mutateAsync();
      setPreviewHtml(result.html);
      setPreviewSubject(result.subject);
      setPreviewOpen(true);
    } catch (error) {
      toast.error(`Failed to generate preview: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return (
          <Badge variant="default" className="bg-primary/10 text-primary border-primary/20">
            <CheckCircle className="h-3 w-3 mr-1" />
            Sent
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      case 'queued':
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            Queued
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Reports</h1>
            <p className="text-muted-foreground">
              Weekly compliance reports sent every Monday at 07:00 (Europe/London)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Actions Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              Email Actions
            </CardTitle>
            <CardDescription>
              Preview or send test reports to office@oxygen.rocks
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                onClick={handlePreview}
                disabled={previewEmail.isPending}
              >
                <Eye className="h-4 w-4 mr-2" />
                {previewEmail.isPending ? 'Generating...' : 'Preview Report'}
              </Button>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button disabled={sendTestEmail.isPending}>
                    <Send className="h-4 w-4 mr-2" />
                    {sendTestEmail.isPending ? 'Sending...' : 'Send Test Email'}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Send Test Email?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will send a test compliance report email to{' '}
                      <strong>office@oxygen.rocks</strong>. This is a real email
                      and will appear in the inbox.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleSendTest}>
                      Send Test Email
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>

        {/* Run History Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Email History</CardTitle>
            <CardDescription>
              Last 12 scheduled email runs
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                Loading...
              </div>
            ) : !emailRuns || emailRuns.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <AlertCircle className="h-8 w-8 mb-2" />
                <p>No email runs found</p>
                <p className="text-sm">Send a test email to see it appear here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {emailRuns.map((run) => (
                  <div
                    key={run.id}
                    className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm truncate">
                          {run.run_key}
                        </span>
                        {getStatusBadge(run.status)}
                      </div>
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        <p>
                          Scheduled: {format(new Date(run.scheduled_for), 'PPp')}
                        </p>
                        {run.sent_at && (
                          <p>
                            Sent: {format(new Date(run.sent_at), 'PPp')}
                          </p>
                        )}
                        {run.recipient_email && (
                          <p>To: {run.recipient_email}</p>
                        )}
                      </div>
                    </div>
                    
                    {run.error && (
                      <div className="ml-4 max-w-xs">
                        <p className="text-xs text-destructive truncate" title={run.error}>
                          Error: {run.error}
                        </p>
                      </div>
                    )}
                    
                    {run.provider_message_id && (
                      <div className="ml-4">
                        <Badge variant="outline" className="text-xs">
                          ID: {run.provider_message_id.substring(0, 8)}...
                        </Badge>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Schedule Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Schedule Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">📅 Schedule</h4>
                <p className="text-sm text-muted-foreground">
                  Every Monday at 07:00 (Europe/London)
                </p>
              </div>
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">📧 Recipient</h4>
                <p className="text-sm text-muted-foreground">
                  office@oxygen.rocks
                </p>
              </div>
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">📊 Report Contents</h4>
                <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                  <li>Overdue compliance items</li>
                  <li>Items due in next 30 days</li>
                  <li>Last 7 days activity</li>
                  <li>Portfolio KPIs</li>
                </ul>
              </div>
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">🔒 Idempotency</h4>
                <p className="text-sm text-muted-foreground">
                  Each weekly run uses a unique key to prevent duplicate emails
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Preview Dialog */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>{previewSubject || 'Email Preview'}</DialogTitle>
              <DialogDescription>
                This is how the weekly compliance email will appear
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="h-[70vh] border rounded-lg">
              <div 
                className="p-4"
                dangerouslySetInnerHTML={{ __html: previewHtml }} 
              />
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
