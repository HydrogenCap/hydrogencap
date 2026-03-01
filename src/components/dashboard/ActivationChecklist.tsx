import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Circle, ArrowRight, X, Rocket, PartyPopper } from 'lucide-react';
import { useActivationChecklist } from '@/hooks/useActivationChecklist';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

export function ActivationChecklist() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    items,
    completedCount,
    totalItems,
    allRequiredComplete,
    dismissed,
    isLoading,
    dismiss,
  } = useActivationChecklist();

  if (isLoading || dismissed) return null;

  const progressPercent = totalItems > 0 ? (completedCount / totalItems) * 100 : 0;

  const handleDismiss = async () => {
    await dismiss();
    queryClient.invalidateQueries({ queryKey: ['activation-checklist'] });
  };

  if (allRequiredComplete) {
    return (
      <Card className="border-emerald-500/30 bg-emerald-500/5">
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <PartyPopper className="h-8 w-8 text-emerald-500" />
              <div>
                <h3 className="font-semibold text-foreground">Setup complete!</h3>
                <p className="text-sm text-muted-foreground">You're ready to manage your portfolio like a pro.</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={handleDismiss} className="shrink-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Rocket className="h-5 w-5 text-primary" />
            Get Started with Hydrogen Capital
          </CardTitle>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{completedCount}/{totalItems} complete</span>
            <Button variant="ghost" size="icon" onClick={handleDismiss} className="h-7 w-7">
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <Progress value={progressPercent} className="h-1.5 mt-2" />
      </CardHeader>
      <CardContent className="pt-0 space-y-1">
        {items.map(item => (
          <div
            key={item.id}
            className={cn(
              'flex items-center justify-between py-2 px-2 rounded-md transition-colors',
              item.completed ? 'opacity-60' : 'hover:bg-muted/50'
            )}
          >
            <div className="flex items-center gap-3 min-w-0">
              {item.completed ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground/40 shrink-0" />
              )}
              <div className="min-w-0">
                <p className={cn('text-sm font-medium', item.completed && 'line-through text-muted-foreground')}>
                  {item.label}
                  {item.optional && <span className="text-muted-foreground font-normal ml-1">(optional)</span>}
                </p>
                <p className="text-xs text-muted-foreground truncate">{item.description}</p>
              </div>
            </div>
            {!item.completed && (
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 text-xs gap-1"
                onClick={() => navigate(item.route)}
              >
                Do this <ArrowRight className="h-3 w-3" />
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
