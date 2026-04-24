import { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, Save, Trash2, Loader2, CheckCircle2 } from 'lucide-react';
import { WizardStepper } from './WizardStepper';
import { WizardIssuesPanel } from './WizardIssuesPanel';
import { useWizardDraft } from '@/hooks/useWizardDraft';
import { useToast } from '@/hooks/use-toast';
import { runCrossChecks, PROPERTY_CROSS_CHECKS } from '@/lib/wizard/crossChecks';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import type { WizardStepConfig, WizardType, WizardPayload, ValidationError, StepStatus, CrossCheckRule } from '@/lib/wizard/types';

interface WizardShellProps {
  title: string;
  steps: WizardStepConfig[];
  wizardType: WizardType;
  crossChecks?: CrossCheckRule[];
  onSubmit: (payload: WizardPayload, draftId: string) => Promise<void>;
  children: (props: {
    payload: WizardPayload;
    updatePayload: (partial: Partial<WizardPayload>) => void;
    currentStep: number;
  }) => React.ReactNode;
}

export function WizardShell({
  title,
  steps,
  wizardType,
  crossChecks = PROPERTY_CROSS_CHECKS,
  onSubmit,
  children,
}: WizardShellProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const {
    draft,
    isLoading,
    isSaving,
    lastSaved,
    payload,
    createDraft,
    updatePayload,
    setStep,
    saveDraft,
    discardDraft,
    markSubmitted,
  } = useWizardDraft(wizardType);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentStep = draft?.current_step ?? 0;

  // Sync step from URL on mount
  useEffect(() => {
    const urlStep = parseInt(searchParams.get('step') || '0');
    if (draft && urlStep !== currentStep && urlStep >= 0 && urlStep < steps.length) {
      setStep(urlStep);
    }
  }, [searchParams, currentStep, draft, setStep, steps.length]);

  // Auto-create draft on first load if none exists
  useEffect(() => {
    if (!isLoading && !draft) {
      createDraft();
    }
  }, [isLoading, draft, createDraft]);

  // Compute all issues across all steps + cross-checks
  const allIssues = useMemo<ValidationError[]>(() => {
    const stepIssues = steps.flatMap((step) => {
      const result = step.validate(payload);
      return result.errors;
    });

    const crossCheckIssues = runCrossChecks(payload, crossChecks).map((r) => ({
      field: r.id,
      message: r.message,
      priority: r.priority,
    }));

    return [...stepIssues, ...crossCheckIssues];
  }, [payload, steps, crossChecks]);

  // Current step issues
  const _currentStepIssues = useMemo(() => {
    const result = steps[currentStep]?.validate(payload);
    return result?.errors || [];
  }, [payload, currentStep, steps]);

  // Step statuses for the stepper
  const stepStatuses = useMemo<StepStatus[]>(() => {
    return steps.map((step, i) => {
      const result = step.validate(payload);
      if (i === currentStep) return 'in_progress';
      const hasP0 = result.errors.some((e) => e.priority === 'P0');
      if (hasP0) return 'error';
      if (result.valid) return 'complete';
      if (result.errors.length > 0) return 'in_progress';
      return 'empty';
    });
  }, [payload, currentStep, steps]);

  const handleStepClick = useCallback(
    (step: number) => {
      setStep(step);
      setSearchParams({ step: String(step) });
    },
    [setStep, setSearchParams]
  );

  const handleNext = useCallback(() => {
    if (currentStep < steps.length - 1) {
      handleStepClick(currentStep + 1);
    }
  }, [currentStep, steps.length, handleStepClick]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      handleStepClick(currentStep - 1);
    }
  }, [currentStep, handleStepClick]);

  const handleSaveAndExit = useCallback(async () => {
    await saveDraft();
    toast({ title: 'Draft saved', description: 'You can resume this wizard later.' });
    navigate('/wizards');
  }, [saveDraft, navigate, toast]);

  const handleDiscard = useCallback(async () => {
    await discardDraft();
    toast({ title: 'Draft discarded' });
    navigate('/wizards');
  }, [discardDraft, navigate, toast]);

  const handleSubmit = useCallback(async () => {
    // Check for P0 blockers
    const p0Issues = allIssues.filter((i) => i.priority === 'P0');
    if (p0Issues.length > 0) {
      toast({
        title: 'Cannot submit',
        description: `${p0Issues.length} critical issue${p0Issues.length > 1 ? 's' : ''} must be resolved first.`,
        variant: 'destructive',
      });
      return;
    }

    if (!draft?.id) return;
    setIsSubmitting(true);
    try {
      await onSubmit(payload, draft.id);
      await markSubmitted();
      toast({ title: `${title} submitted successfully!` });
    } catch (err: unknown) {
      toast({
        title: 'Submission failed',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [allIssues, draft?.id, payload, onSubmit, markSubmitted, title, toast]);

  const isLastStep = currentStep === steps.length - 1;
  const p0Count = allIssues.filter((i) => i.priority === 'P0').length;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/wizards')}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {lastSaved && (
            <span className="text-muted-foreground text-xs">
              {isSaving ? 'Saving...' : `Saved ${formatTimeAgo(lastSaved)}`}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={handleSaveAndExit}>
            <Save className="h-4 w-4 mr-1" /> Save & Exit
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Discard this draft?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. All data entered in this wizard will be permanently deleted.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDiscard} className="bg-destructive text-destructive-foreground">
                  Discard
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Stepper sidebar (desktop) */}
        <aside className="hidden lg:block w-56 border-r border-border bg-card p-4 overflow-y-auto">
          <WizardStepper
            steps={steps}
            currentStep={currentStep}
            stepStatuses={stepStatuses}
            onStepClick={handleStepClick}
          />
        </aside>

        {/* Mobile progress bar */}
        <div className="lg:hidden fixed top-[57px] left-0 right-0 z-10 bg-card border-b border-border px-4 py-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>{steps[currentStep]?.title}</span>
            <span>Step {currentStep + 1} of {steps.length}</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all rounded-full"
              style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-6 lg:pt-6 pt-16" aria-live="polite">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-xl font-semibold mb-1">{steps[currentStep]?.title}</h2>
            {steps[currentStep]?.subtitle && (
              <p className="text-sm text-muted-foreground mb-6">{steps[currentStep].subtitle}</p>
            )}
            {children({ payload, updatePayload, currentStep })}
          </div>
        </main>

        {/* Issues panel (desktop) */}
        <aside className="hidden xl:block w-64 border-l border-border bg-card p-4 overflow-y-auto">
          <WizardIssuesPanel issues={allIssues} />
        </aside>
      </div>

      {/* Footer */}
      <footer className="border-t border-border bg-card px-4 py-3 flex items-center justify-between">
        <Button
          variant="outline"
          onClick={handlePrev}
          disabled={currentStep === 0}
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Previous
        </Button>

        <span className="text-sm text-muted-foreground hidden sm:block">
          Step {currentStep + 1} of {steps.length}
          {p0Count > 0 && (
            <span className="text-destructive ml-2">· {p0Count} blocker{p0Count > 1 ? 's' : ''}</span>
          )}
        </span>

        {isLastStep ? (
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || p0Count > 0}
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-1" />
            )}
            Submit
          </Button>
        ) : (
          <Button onClick={handleNext}>
            Next <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </footer>
    </div>
  );
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ago`;
}
