import { Check } from 'lucide-react';

interface ImportStepperProps {
  currentStep: number;
  steps: string[];
}

export function ImportStepper({ currentStep, steps }: ImportStepperProps) {
  return (
    <div className="flex items-center justify-center gap-2">
      {steps.map((step, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;
        
        return (
          <div key={step} className="flex items-center">
            {index > 0 && (
              <div 
                className={`w-12 h-0.5 mx-2 ${
                  isCompleted ? 'bg-primary' : 'bg-border'
                }`}
              />
            )}
            <div className="flex flex-col items-center">
              <div 
                className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  isCompleted 
                    ? 'bg-primary text-primary-foreground' 
                    : isCurrent 
                      ? 'bg-primary/20 text-primary border-2 border-primary' 
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : index + 1}
              </div>
              <span className={`text-xs mt-1 ${
                isCurrent ? 'text-foreground font-medium' : 'text-muted-foreground'
              }`}>
                {step}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
