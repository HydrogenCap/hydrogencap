import { Checkbox } from '@/components/ui/checkbox';
import { Target } from 'lucide-react';
import { TEXT } from '@/lib/design-tokens';

const GOALS = [
  { id: 'compliance', label: 'Track compliance', description: 'Never miss a certificate expiry' },
  { id: 'tenants_rent', label: 'Manage tenants & rent', description: 'Track tenancies, arrears, and payments' },
  { id: 'analytics', label: 'Portfolio analytics', description: 'Cashflow, yields, and performance metrics' },
  { id: 'investor_reporting', label: 'Investor reporting', description: 'Generate reports for stakeholders' },
  { id: 'development', label: 'Development tracking', description: 'Manage refurb and development projects' },
];

interface GoalsStepProps {
  selectedGoals: string[];
  onToggleGoal: (id: string) => void;
}

export function GoalsStep({ selectedGoals, onToggleGoal }: GoalsStepProps) {
  return (
    <div className="space-y-5">
      <div className="text-center space-y-1">
        <Target className="mx-auto h-10 w-10 text-primary" />
        <h2 className={TEXT.sectionHeading}>What matters most to you?</h2>
        <p className={TEXT.label}>We'll tailor your dashboard and highlight relevant features.</p>
      </div>

      <div className="space-y-3">
        {GOALS.map(goal => (
          <label
            key={goal.id}
            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              selectedGoals.includes(goal.id)
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-muted-foreground/30'
            }`}
          >
            <Checkbox
              checked={selectedGoals.includes(goal.id)}
              onCheckedChange={() => onToggleGoal(goal.id)}
              className="mt-0.5"
            />
            <div>
              <div className="font-medium text-sm">{goal.label}</div>
              <div className="text-xs text-muted-foreground">{goal.description}</div>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}
