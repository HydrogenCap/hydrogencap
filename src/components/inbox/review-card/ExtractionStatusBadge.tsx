import { Badge } from '@/components/ui/badge';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import { AlertCircle, CheckCircle2, Clock, Edit2, Loader2 } from 'lucide-react';
import { SEVERITY } from '@/lib/design-tokens';
import { COMPLIANCE_DOC_TYPE_LABELS } from '@/hooks/useComplianceIntake';

interface Props {
  status: string;
  docType?: string | null;
  validationErrors?: string[] | null;
}

export function ExtractionStatusBadge({ status, docType, validationErrors }: Props) {
  switch (status) {
    case 'pending':
      return (
        <Badge variant="outline" className={SEVERITY.neutral.badge}>
          <span className={`inline-block h-2 w-2 rounded-full mr-1.5 ${SEVERITY.neutral.dot}`} />
          Queued
        </Badge>
      );
    case 'processing':
      return (
        <Badge variant="outline" className={SEVERITY.info.badge}>
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          Analysing...
        </Badge>
      );
    case 'completed':
      return (
        <Badge className={SEVERITY.success.badge}>
          <CheckCircle2 className="h-3 w-3 mr-1" />
          {docType ? (COMPLIANCE_DOC_TYPE_LABELS[docType] || 'Classified') : 'Processed'}
        </Badge>
      );
    case 'failed': {
      const errorMsg = validationErrors?.[0];
      if (errorMsg) {
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge className={SEVERITY.critical.badge}>
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Failed
                </Badge>
              </TooltipTrigger>
              <TooltipContent><p>{errorMsg}</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      }
      return (
        <Badge className={SEVERITY.critical.badge}>
          <AlertCircle className="h-3 w-3 mr-1" />
          Failed
        </Badge>
      );
    }
    case 'rate_limited':
      return (
        <Badge className={SEVERITY.warning.badge}>
          <Clock className="h-3 w-3 mr-1" />
          Rate limited — retry in a few minutes
        </Badge>
      );
    case 'credits_exhausted':
      return (
        <Badge className={SEVERITY.warning.badge}>
          <AlertCircle className="h-3 w-3 mr-1" />
          AI processing unavailable
        </Badge>
      );
    case 'review_needed':
      return (
        <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
          <Edit2 className="h-3 w-3 mr-1" />
          Needs manual review
        </Badge>
      );
    default:
      return null;
  }
}
