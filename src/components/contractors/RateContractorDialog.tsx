import React, { useState } from 'react';
import { Star, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useRateContractor } from '@/hooks/useContractorUpgrade';
import { cn } from '@/lib/utils';

interface RateContractorDialogProps {
  contractorId: string | null;
  contractorName?: string;
  jobId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function StarRating({
  value,
  onChange,
  size = 'md',
}: {
  value: number;
  onChange: (v: number) => void;
  size?: 'sm' | 'md';
}) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(star)}
          className="focus:outline-none"
        >
          <Star
            className={cn(
              size === 'sm' ? 'h-5 w-5' : 'h-7 w-7',
              'transition-colors',
              (hover || value) >= star
                ? 'fill-amber-400 text-amber-400'
                : 'text-muted-foreground'
            )}
          />
        </button>
      ))}
    </div>
  );
}

const RATING_LABELS = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];

export function RateContractorDialog({
  contractorId,
  contractorName,
  jobId,
  open,
  onOpenChange,
}: RateContractorDialogProps) {
  const [overallRating, setOverallRating] = useState(0);
  const [qualityScore, setQualityScore] = useState(0);
  const [timelinessScore, setTimelinessScore] = useState(0);
  const [communicationScore, setCommunicationScore] = useState(0);
  const [valueScore, setValueScore] = useState(0);
  const [reviewText, setReviewText] = useState('');

  const rateContractor = useRateContractor();

  const resetForm = () => {
    setOverallRating(0);
    setQualityScore(0);
    setTimelinessScore(0);
    setCommunicationScore(0);
    setValueScore(0);
    setReviewText('');
  };

  const handleSubmit = async () => {
    if (!contractorId || !jobId || overallRating === 0) return;

    await rateContractor.mutateAsync({
      contractorId,
      jobId,
      rating: overallRating,
      qualityScore: qualityScore || undefined,
      timelinessScore: timelinessScore || undefined,
      communicationScore: communicationScore || undefined,
      valueScore: valueScore || undefined,
      reviewText: reviewText || undefined,
    });

    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Rate Contractor</DialogTitle>
          <DialogDescription>
            {contractorName
              ? `How was your experience with ${contractorName}?`
              : 'Rate the contractor for this completed job.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Overall Rating */}
          <div className="space-y-2 text-center">
            <Label className="text-base font-medium">Overall Rating *</Label>
            <div className="flex items-center justify-center gap-2">
              <StarRating value={overallRating} onChange={setOverallRating} />
            </div>
            {overallRating > 0 && (
              <p className="text-sm text-muted-foreground">{RATING_LABELS[overallRating]}</p>
            )}
          </div>

          {/* Sub-ratings */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Quality of Work</Label>
              <StarRating value={qualityScore} onChange={setQualityScore} size="sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Timeliness</Label>
              <StarRating value={timelinessScore} onChange={setTimelinessScore} size="sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Communication</Label>
              <StarRating value={communicationScore} onChange={setCommunicationScore} size="sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Value for Money</Label>
              <StarRating value={valueScore} onChange={setValueScore} size="sm" />
            </div>
          </div>

          {/* Review Text */}
          <div className="space-y-2">
            <Label htmlFor="review-text">Written Review (optional)</Label>
            <Textarea
              id="review-text"
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="Share your experience with this contractor..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { resetForm(); onOpenChange(false); }}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={overallRating === 0 || rateContractor.isPending}
          >
            {rateContractor.isPending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Submitting...</>
            ) : (
              'Submit Rating'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
