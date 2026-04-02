import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useMaintenanceQuotes, useUpdateQuoteStatus, type MaintenanceQuote } from '@/hooks/useMaintenanceQuotes';
import { AddQuoteDialog } from './AddQuoteDialog';
import { FileText, Check, X, Clock, Award, Zap } from 'lucide-react';
import { format } from 'date-fns';

interface QuoteComparisonSectionProps {
  requestId: string;
}

function QuoteStatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { label: string; className: string }> = {
    pending: { label: 'Pending', className: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800' },
    accepted: { label: 'Accepted', className: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800' },
    rejected: { label: 'Rejected', className: 'bg-muted text-muted-foreground border-border' },
    expired: { label: 'Expired', className: 'bg-muted text-muted-foreground border-border' },
  };
  const c = cfg[status] || cfg.pending;
  return <Badge variant="outline" className={c.className}>{c.label}</Badge>;
}

export function QuoteComparisonSection({ requestId }: QuoteComparisonSectionProps) {
  const { data: quotes, isLoading } = useMaintenanceQuotes(requestId);
  const updateStatus = useUpdateQuoteStatus();

  if (isLoading) return null;

  const pendingQuotes = quotes?.filter(q => q.status === 'pending') || [];
  const allQuotes = quotes || [];
  const hasAccepted = allQuotes.some(q => q.status === 'accepted');

  // Find best price and fastest among pending
  const lowestAmount = pendingQuotes.length > 0 ? Math.min(...pendingQuotes.map(q => q.amount)) : null;
  const fastestDays = pendingQuotes.filter(q => q.estimated_days).length > 0
    ? Math.min(...pendingQuotes.filter(q => q.estimated_days).map(q => q.estimated_days!))
    : null;

  const handleAccept = (quote: MaintenanceQuote) => {
    updateStatus.mutate({ quoteId: quote.id, requestId, status: 'accepted', amount: quote.amount });
  };

  const handleReject = (quote: MaintenanceQuote) => {
    updateStatus.mutate({ quoteId: quote.id, requestId, status: 'rejected' });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Quotes ({allQuotes.length})
          </CardTitle>
          {!hasAccepted && <AddQuoteDialog requestId={requestId} />}
        </div>
      </CardHeader>
      <CardContent>
        {allQuotes.length === 0 ? (
          <div className="text-center py-6 space-y-3">
            <p className="text-sm text-muted-foreground">No quotes yet. Add quotes from contractors to compare.</p>
            <AddQuoteDialog requestId={requestId} />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {allQuotes.map(q => {
              const isBestPrice = q.status === 'pending' && q.amount === lowestAmount && pendingQuotes.length > 1;
              const isFastest = q.status === 'pending' && q.estimated_days !== null && q.estimated_days === fastestDays && pendingQuotes.length > 1;
              const isRejected = q.status === 'rejected';
              const isAccepted = q.status === 'accepted';

              return (
                <div
                  key={q.id}
                  className={`rounded-lg border p-4 space-y-3 transition-opacity ${
                    isAccepted ? 'border-green-300 bg-green-50/50 dark:bg-green-950/20' :
                    isBestPrice ? 'border-green-300' :
                    isRejected ? 'opacity-50' : 'border-border'
                  }`}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm truncate">
                      {q.contractor?.company_name || q.contractor_name || 'Unknown'}
                    </span>
                    <QuoteStatusBadge status={q.status} />
                  </div>

                  {/* Badges */}
                  <div className="flex gap-1.5 flex-wrap">
                    {isAccepted && (
                      <Badge className="bg-green-600 text-white text-[10px]"><Check className="h-3 w-3 mr-0.5" /> Accepted</Badge>
                    )}
                    {isBestPrice && (
                      <Badge variant="outline" className="text-[10px] border-green-300 text-green-700"><Award className="h-3 w-3 mr-0.5" /> Best price</Badge>
                    )}
                    {isFastest && (
                      <Badge variant="outline" className="text-[10px] border-blue-300 text-blue-700"><Zap className="h-3 w-3 mr-0.5" /> Fastest</Badge>
                    )}
                  </div>

                  {/* Details */}
                  <div className="space-y-1 text-sm">
                    <p className="font-semibold text-lg">£{Number(q.amount).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</p>
                    {q.estimated_days && (
                      <p className="text-muted-foreground flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {q.estimated_days} day{q.estimated_days !== 1 ? 's' : ''}</p>
                    )}
                    {q.valid_until && (
                      <p className="text-muted-foreground text-xs">Valid until {format(new Date(q.valid_until), 'dd MMM yyyy')}</p>
                    )}
                    {q.description && <p className="text-xs text-muted-foreground line-clamp-2">{q.description}</p>}
                  </div>

                  {/* Actions */}
                  {q.status === 'pending' && !hasAccepted && (
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" className="flex-1" onClick={() => handleAccept(q)} disabled={updateStatus.isPending}>
                        <Check className="h-3.5 w-3.5 mr-1" /> Accept
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleReject(q)} disabled={updateStatus.isPending}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
