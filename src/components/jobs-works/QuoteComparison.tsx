import React, { useState } from 'react';
import { Check, X, Clock, Star, Loader2, PoundSterling, Plus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useJobQuotes, useRequestQuote, useRespondToQuote, type JobQuote } from '@/hooks/useContractorUpgrade';
import { useContractors } from '@/hooks/useContractors';
import { cn } from '@/lib/utils';

interface QuoteComparisonProps {
  jobId: string;
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  accepted: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  expired: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
};


function getResponseTime(quote: JobQuote): string | null {
  if (!quote.responded_at || !quote.submitted_at) return null;
  const diff = new Date(quote.responded_at).getTime() - new Date(quote.submitted_at).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return `${Math.ceil(diff / (1000 * 60))}m`;
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function QuoteComparison({ jobId }: QuoteComparisonProps) {
  const { data: quotes = [], isLoading } = useJobQuotes(jobId);
  const respondToQuote = useRespondToQuote();
  const [showAddQuote, setShowAddQuote] = useState(false);

  const pendingQuotes = quotes.filter((q) => q.status === 'pending');
  const hasAccepted = quotes.some((q) => q.status === 'accepted');
  const lowestAmount = pendingQuotes.length > 0 ? Math.min(...pendingQuotes.map((q) => q.amount)) : null;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">
          Quotes ({quotes.length})
          {pendingQuotes.length > 0 && (
            <Badge variant="secondary" className="ml-2">{pendingQuotes.length} pending</Badge>
          )}
        </h3>
        <Button variant="outline" size="sm" onClick={() => setShowAddQuote(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Add Quote
        </Button>
      </div>

      {quotes.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <PoundSterling className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground mb-3">No quotes yet for this job.</p>
            <Button variant="outline" size="sm" onClick={() => setShowAddQuote(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Request Quote
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {quotes.map((quote) => {
            const responseTime = getResponseTime(quote);
            const isLowest = quote.status === 'pending' && quote.amount === lowestAmount;

            return (
              <Card
                key={quote.id}
                className={cn(
                  'relative',
                  quote.status === 'accepted' && 'ring-2 ring-emerald-500',
                  isLowest && quote.status === 'pending' && 'ring-1 ring-blue-400'
                )}
              >
                {isLowest && quote.status === 'pending' && (
                  <div className="absolute -top-2 right-3">
                    <Badge className="bg-blue-500 text-white text-xs">Best Price</Badge>
                  </div>
                )}

                <CardContent className="p-4 space-y-3">
                  {/* Contractor info */}
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-sm">{quote.contractor?.name || 'Unknown'}</p>
                      {quote.contractor?.company_name && (
                        <p className="text-xs text-muted-foreground">{quote.contractor.company_name}</p>
                      )}
                    </div>
                    <Badge className={cn('text-xs', STATUS_STYLES[quote.status])}>
                      {quote.status}
                    </Badge>
                  </div>

                  {/* Amount */}
                  <div className="text-2xl font-bold">{formatCurrency(quote.amount)}</div>

                  {/* Description */}
                  {quote.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{quote.description}</p>
                  )}

                  {/* Meta */}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {quote.contractor?.average_rating != null && quote.contractor.average_rating > 0 && (
                      <span className="flex items-center gap-0.5">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        {quote.contractor.average_rating.toFixed(1)}
                      </span>
                    )}
                    {responseTime && (
                      <span className="flex items-center gap-0.5">
                        <Clock className="h-3 w-3" />
                        Responded in {responseTime}
                      </span>
                    )}
                    {quote.valid_until && (
                      <span>Valid until {new Date(quote.valid_until).toLocaleDateString('en-GB')}</span>
                    )}
                  </div>

                  {/* Actions */}
                  {quote.status === 'pending' && !hasAccepted && (
                    <div className="flex items-center gap-2 pt-2 border-t">
                      <Button
                        size="sm"
                        className="flex-1 h-8 text-xs"
                        onClick={() =>
                          respondToQuote.mutate({
                            quoteId: quote.id,
                            jobId,
                            status: 'accepted',
                          })
                        }
                        disabled={respondToQuote.isPending}
                      >
                        <Check className="h-3.5 w-3.5 mr-1" />
                        Accept
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() =>
                          respondToQuote.mutate({
                            quoteId: quote.id,
                            jobId,
                            status: 'rejected',
                          })
                        }
                        disabled={respondToQuote.isPending}
                      >
                        <X className="h-3.5 w-3.5 mr-1" />
                        Reject
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AddQuoteDialog jobId={jobId} open={showAddQuote} onOpenChange={setShowAddQuote} />
    </div>
  );
}

// ── Add Quote Dialog ───────────────────────────────────────────────────────────

function AddQuoteDialog({
  jobId,
  open,
  onOpenChange,
}: {
  jobId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: contractors = [] } = useContractors({ isActive: true });
  const requestQuote = useRequestQuote();

  const [contractorId, setContractorId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [validUntil, setValidUntil] = useState('');

  const handleSubmit = async () => {
    if (!contractorId || !amount) return;

    await requestQuote.mutateAsync({
      jobId,
      contractorId,
      amount: parseFloat(amount),
      description: description || undefined,
      validUntil: validUntil || undefined,
    });

    setContractorId('');
    setAmount('');
    setDescription('');
    setValidUntil('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Quote</DialogTitle>
          <DialogDescription>Record a quote from a contractor for this job.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Contractor *</Label>
            <Select value={contractorId} onValueChange={setContractorId}>
              <SelectTrigger><SelectValue placeholder="Select contractor" /></SelectTrigger>
              <SelectContent>
                {contractors.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} {c.company_name ? `(${c.company_name})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Amount (£) *</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Quote details, scope of work..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Valid Until</Label>
            <Input
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!contractorId || !amount || requestQuote.isPending}>
            {requestQuote.isPending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>
            ) : (
              'Add Quote'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
