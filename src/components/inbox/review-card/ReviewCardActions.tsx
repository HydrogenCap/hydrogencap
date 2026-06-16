import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { CollapsibleTrigger } from '@/components/ui/collapsible';
import { Check, ChevronDown, Loader2, RefreshCw, Trash2, X } from 'lucide-react';

interface Props {
  isExpanded: boolean;
  isProcessing: boolean;
  isRetrying: boolean;
  isFailed: boolean;
  isRateLimited: boolean;
  hasTimedOut: boolean;
  isCreditsExhausted: boolean;
  isActionable: boolean;
  canAcceptManually: boolean;
  isReadyForConfirm: boolean;
  selectedDocType: string;
  selectedPropertyId: string;
  onRetry: () => void;
  onDelete: () => void;
  onAccept: () => void;
  onReject: () => void;
}

export function ReviewCardActions(p: Props) {
  return (
    <div className="flex items-center gap-2 shrink-0">
      <CollapsibleTrigger asChild>
        <Button aria-label="Expand" variant="ghost" size="icon">
          <ChevronDown className={`h-4 w-4 transition-transform ${p.isExpanded ? 'rotate-180' : ''}`} />
        </Button>
      </CollapsibleTrigger>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            aria-label="Delete"
            size="icon"
            variant="ghost"
            className="text-muted-foreground hover:text-destructive"
            disabled={p.isProcessing}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this document?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={p.onDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {(p.isFailed || p.isRateLimited || p.hasTimedOut) ? (
        <Button variant="outline" onClick={p.onRetry} disabled={p.isRetrying}>
          {p.isRetrying ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
          Retry
        </Button>
      ) : null}

      {!p.isCreditsExhausted && (
        <>
          <Button
            aria-label="Close"
            size="icon"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={p.onReject}
            disabled={p.isProcessing}
          >
            <X className="h-4 w-4" />
          </Button>

          <Button
            onClick={p.onAccept}
            disabled={p.isProcessing || (!p.isActionable && !p.canAcceptManually) || !p.selectedDocType}
            className={p.isReadyForConfirm ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
          >
            {p.isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Check className="h-4 w-4 mr-1" />
                {p.canAcceptManually ? 'Accept manually' : p.isReadyForConfirm ? 'Confirm' : 'Review'}
              </>
            )}
          </Button>
        </>
      )}

      {p.isCreditsExhausted && (
        <>
          <Button
            aria-label="Close"
            size="icon"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={p.onReject}
            disabled={p.isProcessing}
          >
            <X className="h-4 w-4" />
          </Button>
          <Button
            onClick={p.onAccept}
            disabled={p.isProcessing || !p.selectedDocType || !p.selectedPropertyId}
          >
            {p.isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Check className="h-4 w-4 mr-1" />
                Accept manually
              </>
            )}
          </Button>
        </>
      )}
    </div>
  );
}
