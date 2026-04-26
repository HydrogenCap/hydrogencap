import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useActivationChecklist } from '@/hooks/useActivationChecklist';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';

interface ActivationItem {
  id: string;
  label: string;
  completed: boolean;
  route: string;
}

const RING_SIZE = 88;
const RING_STROKE = 8;

function ProgressRing({ percent }: { percent: number }) {
  const radius = (RING_SIZE - RING_STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (Math.min(100, Math.max(0, percent)) / 100) * circumference;

  return (
    <div
      className="relative shrink-0"
      style={{ width: RING_SIZE, height: RING_SIZE }}
      role="img"
      aria-label={`${percent}% complete`}
    >
      <svg width={RING_SIZE} height={RING_SIZE} className="-rotate-90">
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={RING_STROKE}
        />
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth={RING_STROKE}
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
          className="transition-[stroke-dasharray] duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-semibold text-foreground">{percent}%</span>
      </div>
    </div>
  );
}

export function ActivationWidget() {
  const navigate = useNavigate();
  const { items: hookItems } = useActivationChecklist();
  const { data: org } = useOrganization();

  const propertyDone = !!hookItems.find(i => i.id === 'add_property')?.completed;
  const complianceDone = !!hookItems.find(i => i.id === 'upload_compliance')?.completed;
  const tenantDone = !!hookItems.find(i => i.id === 'add_tenant')?.completed;
  const teamDone = !!hookItems.find(i => i.id === 'invite_team')?.completed;

  const { data: entityCount = 0 } = useQuery<number>({
    queryKey: ['activation-widget', 'entities', org?.id],
    queryFn: async () => {
      if (!org?.id) return 0;
      const { count } = await supabase
        .from('legal_entities')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', org.id);
      return count ?? 0;
    },
    enabled: !!org?.id,
    staleTime: 1000 * 60 * 5,
  });

  const { data: bankAccountCount = 0 } = useQuery<number>({
    queryKey: ['activation-widget', 'bank-accounts', org?.id],
    queryFn: async () => {
      if (!org?.id) return 0;
      const { count } = await supabase
        .from('bank_accounts')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', org.id);
      return count ?? 0;
    },
    enabled: !!org?.id,
    staleTime: 1000 * 60 * 5,
  });

  const items: ActivationItem[] = [
    { id: 'property', label: 'Add your first property', completed: propertyDone, route: '/properties-v2' },
    { id: 'entity', label: 'Add a company or entity', completed: entityCount > 0, route: '/entities' },
    { id: 'compliance', label: 'Upload a compliance certificate', completed: complianceDone, route: '/compliance-v2' },
    { id: 'tenancy', label: 'Set up a tenancy', completed: tenantDone, route: '/tenants-v2' },
    { id: 'bank', label: 'Connect a bank account', completed: bankAccountCount > 0, route: '/rent/reconciliation' },
    { id: 'team', label: 'Invite a teammate', completed: teamDone, route: '/settings?tab=team' },
  ];

  const completedCount = items.filter(i => i.completed).length;
  const percent = Math.round((completedCount / items.length) * 100);

  if (percent === 100) return null;

  return (
    <Card data-testid="activation-widget">
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row gap-6 items-start">
          <div className="flex flex-col items-center gap-2 md:items-start md:gap-3">
            <ProgressRing percent={percent} />
            <div className="text-sm text-muted-foreground">
              {completedCount} of {items.length} complete
            </div>
          </div>

          <div className="flex-1 w-full">
            <h2 className="text-base font-semibold text-foreground mb-1">
              Get your portfolio set up
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              A few quick steps to unlock the full Tenure IQ workspace.
            </p>
            <ul className="divide-y divide-border border rounded-lg" role="list">
              {items.map(item => (
                <li key={item.id}>
                  {item.completed ? (
                    <div className="flex items-center gap-3 px-4 py-3">
                      <span
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-success/10"
                        aria-hidden="true"
                      >
                        <Check className="h-4 w-4 text-success" />
                      </span>
                      <span className="text-sm text-muted-foreground line-through">
                        {item.label}
                      </span>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      onClick={() => navigate(item.route)}
                      className="w-full justify-between rounded-none px-4 py-3 h-auto font-normal hover:bg-accent"
                      aria-label={`Start: ${item.label}`}
                    >
                      <span className="flex items-center gap-3">
                        <span
                          className="flex h-6 w-6 items-center justify-center rounded-full border border-border"
                          aria-hidden="true"
                        />
                        <span className="text-sm text-foreground">{item.label}</span>
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default ActivationWidget;
