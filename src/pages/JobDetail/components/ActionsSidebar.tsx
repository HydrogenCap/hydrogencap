import { Send, Loader2, Calendar, CheckCircle, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  job: { status: string; contractor?: unknown };
  quotedAmount: string;
  setQuotedAmount: (v: string) => void;
  sendRequest: { isPending: boolean };
  updateJob: { isPending: boolean };
  handleSendRequest: () => void;
  handleRecordQuote: () => void;
  handleAcceptQuote: () => void;
  setShowBookDialog: (v: boolean) => void;
  handleStartWork: () => void;
  setShowCompleteDialog: (v: boolean) => void;
  handleVerify: () => void;
  setShowReviewDialog: (v: boolean) => void;
  handleCancel: () => void;
}

export function ActionsSidebar(p: Props) {
  const { job } = p;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {job.status === 'draft' && job.contractor && (
          <Button onClick={p.handleSendRequest} disabled={p.sendRequest.isPending} className="w-full">
            {p.sendRequest.isPending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending...</>
            ) : (
              <><Send className="h-4 w-4 mr-2" />Send Request</>
            )}
          </Button>
        )}

        {job.status === 'requested' && (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Quote Amount (£)</Label>
              <Input
                type="number"
                value={p.quotedAmount}
                onChange={(e) => p.setQuotedAmount(e.target.value)}
                placeholder="Enter quote amount"
              />
            </div>
            <Button onClick={p.handleRecordQuote} disabled={p.updateJob.isPending} className="w-full">
              Record Quote
            </Button>
          </div>
        )}

        {job.status === 'quoted' && (
          <>
            <Button onClick={p.handleAcceptQuote} className="w-full">
              Accept Quote
            </Button>
            <Button onClick={() => p.setShowBookDialog(true)} variant="outline" className="w-full">
              <Calendar className="h-4 w-4 mr-2" />
              Book Date
            </Button>
          </>
        )}

        {job.status === 'accepted' && (
          <Button onClick={() => p.setShowBookDialog(true)} className="w-full">
            <Calendar className="h-4 w-4 mr-2" />
            Book Date
          </Button>
        )}

        {job.status === 'booked' && (
          <Button onClick={p.handleStartWork} className="w-full">
            Start Work
          </Button>
        )}

        {job.status === 'in_progress' && (
          <Button onClick={() => p.setShowCompleteDialog(true)} className="w-full">
            <CheckCircle className="h-4 w-4 mr-2" />
            Mark Complete
          </Button>
        )}

        {job.status === 'completed' && (
          <>
            <Button onClick={p.handleVerify} className="w-full">
              <CheckCircle className="h-4 w-4 mr-2" />
              Verify & Close
            </Button>
            <Button onClick={() => p.setShowReviewDialog(true)} variant="outline" className="w-full">
              <MessageSquare className="h-4 w-4 mr-2" />
              Add Review
            </Button>
          </>
        )}

        {!['completed', 'verified', 'cancelled'].includes(job.status) && (
          <Button onClick={p.handleCancel} variant="destructive" className="w-full">
            Cancel Job
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
