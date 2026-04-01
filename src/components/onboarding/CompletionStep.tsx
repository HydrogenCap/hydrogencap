import { Button } from '@/components/ui/button';
import { CheckCircle2, LayoutDashboard, Home, FileUp, ArrowRight } from 'lucide-react';
import { useActivationChecklist } from '@/hooks/useActivationChecklist';
import { TEXT } from '@/lib/design-tokens';
import { cn } from '@/lib/utils';

interface CompletionStepProps {
  fullName: string;
  orgName: string;
  selectedGoals: string[];
  onGoToDashboard: () => void;
  onAddProperty: () => void;
  onUploadDocument: () => void;
}

export function CompletionStep({
  fullName,
  orgName,
  selectedGoals,
  onGoToDashboard,
  onAddProperty,
  onUploadDocument,
}: CompletionStepProps) {
  const { items, completedCount, totalItems } = useActivationChecklist();

  const displayName = fullName.split(' ')[0];

  return (
    <div className="space-y-5">
      <div className="text-center space-y-1">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
        <h2 className={TEXT.sectionHeading}>
          You're all set{displayName ? `, ${displayName}` : ''}!
        </h2>
        {orgName && <p className="text-sm text-muted-foreground">{orgName}</p>}
      </div>

      {/* Summary */}
      {selectedGoals.length > 0 && (
        <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Your focus areas</p>
          <div className="flex flex-wrap gap-1.5">
            {selectedGoals.map(g => (
              <span key={g} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                {g.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Activation checklist preview */}
      {totalItems > 0 && (
        <div className="rounded-lg border border-border p-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Setup progress — {completedCount}/{totalItems} complete
          </p>
          <div className="space-y-1">
            {items.slice(0, 4).map(item => (
              <div key={item.id} className="flex items-center gap-2 text-sm">
                <CheckCircle2
                  className={cn(
                    'h-4 w-4 shrink-0',
                    item.completed ? 'text-emerald-500' : 'text-muted-foreground/30'
                  )}
                />
                <span className={item.completed ? 'text-muted-foreground line-through' : ''}>
                  {item.label}
                </span>
              </div>
            ))}
            {totalItems > 4 && (
              <p className="text-xs text-muted-foreground pl-6">+{totalItems - 4} more on your dashboard</p>
            )}
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="flex flex-col gap-2">
        <Button onClick={onGoToDashboard} className="w-full">
          <LayoutDashboard className="h-4 w-4 mr-2" />
          Go to Dashboard
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={onAddProperty} className="text-xs">
            <Home className="h-3.5 w-3.5 mr-1" /> Add a property
          </Button>
          <Button variant="outline" onClick={onUploadDocument} className="text-xs">
            <FileUp className="h-3.5 w-3.5 mr-1" /> Upload a document
          </Button>
        </div>
      </div>
    </div>
  );
}
