import { useState } from 'react';
import { format } from 'date-fns';
import {
  Handshake,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowRightLeft,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatGBP } from '@/lib/calculations';
import {
  useUpdateDeal,
  type DealPipelineItem,
  type OfferResponse,
} from '@/hooks/useDealPipeline';

const RESPONSE_CONFIG: Record<OfferResponse, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  pending: { label: 'Pending', icon: Clock, color: 'bg-amber-500/15 text-amber-700 border-amber-500/30' },
  accepted: { label: 'Accepted', icon: CheckCircle2, color: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30' },
  rejected: { label: 'Rejected', icon: XCircle, color: 'bg-red-500/15 text-red-700 border-red-500/30' },
  countered: { label: 'Countered', icon: ArrowRightLeft, color: 'bg-blue-500/15 text-blue-700 border-blue-500/30' },
};

interface OfferTrackerProps {
  deal: DealPipelineItem;
}

export function OfferTracker({ deal }: OfferTrackerProps) {
  const updateDeal = useUpdateDeal();
  const [editing, setEditing] = useState(false);
  const [offerAmount, setOfferAmount] = useState(deal.offer_amount ?? deal.asking_price ?? 0);
  const [offerDate, setOfferDate] = useState(
    deal.offer_date || new Date().toISOString().slice(0, 10)
  );
  const [notes, setNotes] = useState(deal.notes || '');
  const [counterAmount, setCounterAmount] = useState(deal.counter_offer_amount ?? 0);

  const hasOffer = deal.offer_amount != null;
  const response = deal.offer_response;

  const handleSubmitOffer = () => {
    updateDeal.mutate({
      id: deal.id,
      updates: {
        offer_amount: offerAmount,
        offer_date: offerDate,
        offer_response: 'pending',
        notes: notes || deal.notes,
      },
    });
    setEditing(false);
  };

  const handleResponse = (resp: OfferResponse) => {
    const updates: Record<string, unknown> = { offer_response: resp };
    if (resp === 'countered') {
      updates.counter_offer_amount = counterAmount;
    }
    updateDeal.mutate({ id: deal.id, updates });
  };

  // Timeline events
  const events: { date: string; label: string; icon: React.ComponentType<{ className?: string }> }[] = [];
  if (deal.offer_date) {
    events.push({
      date: deal.offer_date,
      label: `Offer submitted: ${formatGBP(deal.offer_amount)}`,
      icon: Handshake,
    });
  }
  if (deal.offer_response && deal.offer_response !== 'pending') {
    const cfg = RESPONSE_CONFIG[deal.offer_response];
    events.push({
      date: deal.updated_at,
      label: `Response: ${cfg.label}${deal.counter_offer_amount ? ` at ${formatGBP(deal.counter_offer_amount)}` : ''}`,
      icon: cfg.icon,
    });
  }

  return (
    <div className="space-y-4">
      {/* Current status */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Handshake className="h-5 w-5" />
              Offer for {deal.address}
            </CardTitle>
            {response && (
              <Badge className={RESPONSE_CONFIG[response].color}>
                {RESPONSE_CONFIG[response].label}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground block">Asking Price</span>
              <span className="font-medium">{formatGBP(deal.asking_price)}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Offer Amount</span>
              <span className="font-medium">{formatGBP(deal.offer_amount)}</span>
            </div>
            {deal.counter_offer_amount ? (
              <div>
                <span className="text-muted-foreground block">Counter Offer</span>
                <span className="font-medium">{formatGBP(deal.counter_offer_amount)}</span>
              </div>
            ) : (
              <div>
                <span className="text-muted-foreground block">Discount</span>
                <span className="font-medium">
                  {deal.asking_price && deal.offer_amount
                    ? `${(((deal.asking_price - deal.offer_amount) / deal.asking_price) * 100).toFixed(1)}%`
                    : '\u2014'}
                </span>
              </div>
            )}
          </div>

          {/* Make/edit offer */}
          {(!hasOffer || editing) && (
            <div className="border-t pt-4 space-y-3">
              <h4 className="text-sm font-medium">
                {hasOffer ? 'Edit Offer' : 'Submit Offer'}
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Offer Amount (£)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={offerAmount}
                    onChange={e => setOfferAmount(Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label>Offer Date</Label>
                  <Input
                    type="date"
                    value={offerDate}
                    onChange={e => setOfferDate(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label>Conditions / Notes</Label>
                <Textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Subject to survey, completion in 8 weeks..."
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleSubmitOffer}
                  disabled={updateDeal.isPending || offerAmount <= 0}
                >
                  {hasOffer ? 'Update Offer' : 'Submit Offer'}
                </Button>
                {editing && (
                  <Button variant="ghost" onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Response actions */}
          {hasOffer && response === 'pending' && !editing && (
            <div className="border-t pt-4 space-y-3">
              <h4 className="text-sm font-medium">Record Response</h4>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-emerald-700"
                  onClick={() => handleResponse('accepted')}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Accepted
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-700"
                  onClick={() => handleResponse('rejected')}
                >
                  <XCircle className="h-4 w-4 mr-1" /> Rejected
                </Button>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    className="w-28 h-8 text-sm"
                    placeholder="Counter £"
                    value={counterAmount || ''}
                    onChange={e => setCounterAmount(Number(e.target.value))}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-blue-700"
                    onClick={() => handleResponse('countered')}
                    disabled={counterAmount <= 0}
                  >
                    <ArrowRightLeft className="h-4 w-4 mr-1" /> Countered
                  </Button>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditing(true)}
              >
                Edit offer
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Timeline */}
      {events.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Negotiation Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {events.map((ev, i) => {
                const Icon = ev.icon;
                return (
                  <div key={i} className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <div className="rounded-full bg-muted p-1.5">
                        <Icon className="h-3 w-3" />
                      </div>
                      {i < events.length - 1 && (
                        <div className="w-px h-6 bg-border" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{ev.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(ev.date), 'dd MMM yyyy')}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
