import { Check, Calendar, Calculator, ClipboardCheck, CreditCard } from 'lucide-react';

export const STEPS = [
  { label: 'Period', icon: Calendar, description: 'Select period & income' },
  { label: 'Allocate', icon: Calculator, description: 'Preview allocations' },
  { label: 'Review', icon: ClipboardCheck, description: 'Review & approve' },
  { label: 'Payment', icon: CreditCard, description: 'Track payments' },
];

export function WizardStepper({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {STEPS.map((s, i) => {
        const Icon = s.icon;
        const isActive = i === step;
        const isCompleted = i < step;
        return (
          <div key={s.label} className="flex items-center gap-2 flex-1">
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors ${
                isCompleted
                  ? 'bg-primary border-primary text-primary-foreground'
                  : isActive
                    ? 'border-primary text-primary'
                    : 'border-muted-foreground/30 text-muted-foreground'
              }`}
            >
              {isCompleted ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
            </div>
            <div className="hidden sm:block">
              <p className={`text-xs font-medium ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                {s.label}
              </p>
              <p className="text-[10px] text-muted-foreground">{s.description}</p>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-px ${isCompleted ? 'bg-primary' : 'bg-border'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
