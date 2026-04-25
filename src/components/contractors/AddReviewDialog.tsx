 import React, { useState } from 'react';
 import { Star, Loader2 } from 'lucide-react';
 import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
 import { Button } from '@/components/ui/button';
 import { Textarea } from '@/components/ui/textarea';
 import { Label } from '@/components/ui/label';
import { useAddContractorReview } from '@/hooks/useContractors';
import { useToast } from '@/hooks/use-toast';
 import { cn } from '@/lib/utils';
 
 interface AddReviewDialogProps {
   contractorId: string | null;
   jobId?: string;
   open: boolean;
   onOpenChange: (open: boolean) => void;
 }
 
 export function AddReviewDialog({ contractorId, jobId, open, onOpenChange }: AddReviewDialogProps) {
   const [rating, setRating] = useState(0);
   const [reviewText, setReviewText] = useState('');
   const [punctuality, setPunctuality] = useState(0);
   const [quality, setQuality] = useState(0);
   const [value, setValue] = useState(0);
   const [communication, setCommunication] = useState(0);
 
   const addReview = useAddContractorReview();
   const { toast } = useToast();
 
   const handleSubmit = async () => {
     if (!contractorId || rating === 0) return;
 
     try {
       await addReview.mutateAsync({
         contractorId,
         jobId,
         rating,
         reviewText: reviewText || undefined,
         punctualityRating: punctuality || undefined,
         qualityRating: quality || undefined,
         valueRating: value || undefined,
         communicationRating: communication || undefined,
       });
     } catch (err) {
       toast({ title: 'Failed to submit review', description: err instanceof Error ? err.message : 'Please try again.', variant: 'destructive' });
       return;
     }
 
     // Reset and close
     setRating(0);
     setReviewText('');
     setPunctuality(0);
     setQuality(0);
     setValue(0);
     setCommunication(0);
     onOpenChange(false);
   };
 
   const StarRating = ({ 
     value, 
     onChange, 
     size = 'md' 
   }: { 
     value: number; 
     onChange: (v: number) => void; 
     size?: 'sm' | 'md' 
   }) => {
     const [hover, setHover] = useState(0);
     return (
       <div className="flex items-center gap-1">
         {[1, 2, 3, 4, 5].map(star => (
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
                 size === 'sm' ? 'h-4 w-4' : 'h-6 w-6',
                 "transition-colors",
                 (hover || value) >= star
                   ? "fill-amber-400 text-amber-400"
                   : "text-muted-foreground"
               )}
             />
           </button>
         ))}
       </div>
     );
   };
 
   return (
     <Dialog open={open} onOpenChange={onOpenChange}>
       <DialogContent className="max-w-md">
         <DialogHeader>
           <DialogTitle>Add Review</DialogTitle>
           <DialogDescription>
             Rate your experience with this contractor
           </DialogDescription>
         </DialogHeader>
 
         <div className="space-y-6 py-4">
           {/* Overall Rating */}
           <div className="space-y-2">
             <Label>Overall Rating *</Label>
             <div className="flex items-center gap-2">
               <StarRating value={rating} onChange={setRating} />
               {rating > 0 && (
                 <span className="text-sm text-muted-foreground">
                   {rating === 1 ? 'Poor' : rating === 2 ? 'Fair' : rating === 3 ? 'Good' : rating === 4 ? 'Very Good' : 'Excellent'}
                 </span>
               )}
             </div>
           </div>
 
           {/* Sub-ratings */}
           <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
               <Label className="text-xs">Punctuality</Label>
               <StarRating value={punctuality} onChange={setPunctuality} size="sm" />
             </div>
             <div className="space-y-2">
               <Label className="text-xs">Quality</Label>
               <StarRating value={quality} onChange={setQuality} size="sm" />
             </div>
             <div className="space-y-2">
               <Label className="text-xs">Value</Label>
               <StarRating value={value} onChange={setValue} size="sm" />
             </div>
             <div className="space-y-2">
               <Label className="text-xs">Communication</Label>
               <StarRating value={communication} onChange={setCommunication} size="sm" />
             </div>
           </div>
 
           {/* Review Text */}
           <div className="space-y-2">
             <Label htmlFor="review">Written Review (optional)</Label>
             <Textarea
               id="review"
               value={reviewText}
               onChange={(e) => setReviewText(e.target.value)}
               placeholder="Share your experience..."
               rows={3}
             />
           </div>
         </div>
 
         <DialogFooter>
           <Button variant="outline" onClick={() => onOpenChange(false)}>
             Cancel
           </Button>
           <Button onClick={handleSubmit} disabled={rating === 0 || addReview.isPending}>
             {addReview.isPending ? (
               <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Submitting...</>
             ) : (
               'Submit Review'
             )}
           </Button>
         </DialogFooter>
       </DialogContent>
     </Dialog>
   );
 }