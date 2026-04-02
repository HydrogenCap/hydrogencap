import { Check, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Step {
  label: string;
  status: 'pending' | 'active' | 'complete' | 'error';
}

interface ProcessingStepsProps {
  steps: Step[];
}

export function ProcessingSteps({ steps }: ProcessingStepsProps) {
  return (
    <div className="flex items-center gap-1 flex-wrap" aria-live="polite" role="status">
      {steps.map((step, i) => (
        <div key={i} className="flex items-center gap-1">
          {i > 0 && (
            <div
              className={cn(
                'h-px w-4 mx-0.5',
                step.status === 'pending' ? 'bg-muted-foreground/30' : 'bg-primary'
              )}
            />
          )}
          <div className="flex items-center gap-1.5">
            <StepIcon status={step.status} />
            <span
              className={cn(
                'text-xs font-medium whitespace-nowrap',
                step.status === 'pending' && 'text-muted-foreground',
                step.status === 'active' && 'text-primary',
                step.status === 'complete' && 'text-success',
                step.status === 'error' && 'text-destructive'
              )}
            >
              {step.label}
              {step.status === 'complete' && ' \u2713'}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function StepIcon({ status }: { status: Step['status'] }) {
  const base = 'h-4 w-4 shrink-0';

  switch (status) {
    case 'active':
      return <Loader2 className={cn(base, 'text-primary animate-spin motion-reduce:animate-none')} />;
    case 'complete':
      return <Check className={cn(base, 'text-success')} />;
    case 'error':
      return <AlertCircle className={cn(base, 'text-destructive')} />;
    default:
      return (
        <div className={cn('h-4 w-4 shrink-0 rounded-full border-2 border-muted-foreground/30')} />
      );
  }
}
