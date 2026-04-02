import { Button } from '@/components/ui/button';
import { Sparkles, Home, Shield, Users } from 'lucide-react';
import { TEXT } from '@/lib/design-tokens';

interface DemoDataStepProps {
  seeding: boolean;
  onSeedDemo: () => void;
  onSkip: () => void;
}

export function DemoDataStep({ seeding, onSeedDemo, onSkip }: DemoDataStepProps) {
  return (
    <div className="space-y-5">
      <div className="text-center space-y-1">
        <Sparkles className="mx-auto h-10 w-10 text-primary" />
        <h2 className={TEXT.sectionHeading}>Try with demo data?</h2>
        <p className={TEXT.label}>Load a realistic UK portfolio to explore the platform.</p>
      </div>

      <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
        <p className="text-sm font-medium">You'll get 3 sample properties:</p>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Home className="h-4 w-4 text-muted-foreground shrink-0" />
            <span>14 High St, Cheltenham — 5-bed HMO</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Home className="h-4 w-4 text-muted-foreground shrink-0" />
            <span>8 Oak Rd, Oxford — Single let</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Home className="h-4 w-4 text-muted-foreground shrink-0" />
            <span>22 Elm Ave, Bristol — 7-bed HMO (refurb)</span>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
          <span className="flex items-center gap-1"><Shield className="h-3.5 w-3.5" /> Compliance items</span>
          <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> 5 tenants</span>
          <span>Rent schedules</span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Button onClick={onSeedDemo} disabled={seeding} className="w-full">
          <Sparkles className="h-4 w-4 mr-2" />
          {seeding ? 'Loading demo data…' : 'Load demo portfolio'}
        </Button>
        <Button variant="ghost" onClick={onSkip} disabled={seeding} className="w-full">
          No thanks, I'll add my own
        </Button>
      </div>
    </div>
  );
}
