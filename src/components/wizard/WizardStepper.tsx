import { cn } from '@/lib/utils';
import { Check, AlertCircle } from 'lucide-react';
import type { WizardStepConfig, StepStatus } from '@/lib/wizard/types';

interface WizardStepperProps {
  steps: WizardStepConfig[];
  currentStep: number;
  stepStatuses: StepStatus[];
  onStepClick: (step: number) => void;
}

export function WizardStepper({ steps, currentStep, stepStatuses, onStepClick }: WizardStepperProps) {
  return (
    <nav className="space-y-1" aria-label="Wizard steps">
      {steps.map((step, i) => {
        const status = stepStatuses[i] || 'empty';
        const isCurrent = i === currentStep;
        const Icon = step.icon;

        return (
          <button
            key={step.id}
            onClick={() => onStepClick(i)}
            className={cn(
              'w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
              isCurrent
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
            aria-current={isCurrent ? 'step' : undefined}
          >
            <div
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs',
                isCurrent && 'border-primary bg-primary text-primary-foreground',
                status === 'complete' && !isCurrent && 'border-success bg-success/10 text-success',
                status === 'error' && !isCurrent && 'border-destructive bg-destructive/10 text-destructive',
                status === 'empty' && !isCurrent && 'border-border',
                status === 'in_progress' && !isCurrent && 'border-primary/50'
              )}
            >
              {status === 'complete' && !isCurrent ? (
                <Check className="h-3.5 w-3.5" />
              ) : status === 'error' && !isCurrent ? (
                <AlertCircle className="h-3.5 w-3.5" />
              ) : (
                <Icon className="h-3.5 w-3.5" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate">{step.title}</div>
              {step.isOptional && (
                <div className="text-xs text-muted-foreground">Optional</div>
              )}
            </div>
          </button>
        );
      })}
    </nav>
  );
}
