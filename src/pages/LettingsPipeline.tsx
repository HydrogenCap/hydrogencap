import { useState, useMemo } from 'react';
import { differenceInDays, format } from 'date-fns';
import { Plus, ArrowRight, Home, Users, ClipboardCheck, Gift, Key } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { formatGBP } from '@/lib/calculations';
import {
  useLettingsPipeline,
  useAdvanceStage,
  useCompleteLetting,
  KANBAN_STAGES,
  STAGE_LABELS,
  STAGE_ORDER,
  type LettingsStage,
  type LettingsPipelineItem,
} from '@/hooks/useLettingsPipeline';

const STAGE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  marketing: Home,
  viewings: Users,
  referencing: ClipboardCheck,
  offered: Gift,
  move_in_prep: Key,
};

function nextStage(current: LettingsStage): LettingsStage | null {
  const idx = STAGE_ORDER.indexOf(current);
  if (idx < 0 || idx >= STAGE_ORDER.length - 1) return null;
  return STAGE_ORDER[idx + 1];
}

function DaysInStageBadge({ item }: { item: LettingsPipelineItem }) {
  const days = differenceInDays(new Date(), new Date(item.updated_at));
  return (
    <Badge variant={days > 30 ? 'destructive' : days > 14 ? 'secondary' : 'outline'} className="text-xs">
      {days}d
    </Badge>
  );
}

function PipelineCard({ item, onAdvance }: { item: LettingsPipelineItem; onAdvance: (item: LettingsPipelineItem) => void }) {
  const roomLabel = item.room?.room_name || 'Room';
  const address = item.property ? `${item.property.address_line_1}` : '';

  const stageInfo = () => {
    switch (item.stage) {
      case 'marketing':
        return item.advertised_rent ? `${formatGBP(item.advertised_rent)}/mo` : null;
      case 'viewings':
        return `${item.total_viewings} viewing${item.total_viewings !== 1 ? 's' : ''}`;
      case 'referencing':
        return item.reference_status === 'in_progress' ? 'In progress' : item.reference_status === 'passed' ? 'Passed ✓' : item.reference_status || null;
      case 'offered':
        return item.offered_to_name || null;
      case 'move_in_prep':
        return item.target_move_in ? `Move-in ${format(new Date(item.target_move_in), 'dd MMM')}` : null;
      default:
        return null;
    }
  };

  const next = nextStage(item.stage);

  return (
    <Card className="mb-3 hover:shadow-md transition-shadow">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-medium text-sm">{roomLabel}</p>
            <p className="text-xs text-muted-foreground truncate max-w-[180px]">{address}</p>
          </div>
          <DaysInStageBadge item={item} />
        </div>
        {stageInfo() && (
          <p className="text-xs text-muted-foreground">{stageInfo()}</p>
        )}
        {next && (
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs"
            onClick={() => onAdvance(item)}
          >
            Advance <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// Stage advance form fields
function AdvanceForm({
  item,
  onSubmit,
  isPending,
}: {
  item: LettingsPipelineItem;
  onSubmit: (updates: Record<string, any>) => void;
  isPending: boolean;
}) {
  const next = nextStage(item.stage);
  const [formData, setFormData] = useState<Record<string, any>>({});

  const set = (key: string, value: any) => setFormData(prev => ({ ...prev, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!next) return;
    onSubmit({ ...formData, stage: next });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {item.stage === 'marketing' && (
        <>
          <div>
            <Label>Total enquiries received</Label>
            <Input type="number" min={0} onChange={e => set('total_enquiries', Number(e.target.value))} />
          </div>
        </>
      )}

      {item.stage === 'viewings' && (
        <>
          <div>
            <Label>Applicant name</Label>
            <Input onChange={e => set('offered_to_name', e.target.value)} />
          </div>
          <div>
            <Label>Applicant email</Label>
            <Input type="email" onChange={e => set('offered_to_email', e.target.value)} />
          </div>
          <div>
            <Label>Applicant phone</Label>
            <Input onChange={e => set('offered_to_phone', e.target.value)} />
          </div>
          <div>
            <Label>Offered rent (£/mo)</Label>
            <Input type="number" min={0} onChange={e => set('offered_rent', Number(e.target.value))} />
          </div>
          <div>
            <Label>Total viewings</Label>
            <Input type="number" min={0} defaultValue={item.total_viewings} onChange={e => set('total_viewings', Number(e.target.value))} />
          </div>
        </>
      )}

      {item.stage === 'referencing' && (
        <>
          <div>
            <Label>Reference provider</Label>
            <Input onChange={e => set('reference_provider', e.target.value)} />
          </div>
          <div>
            <Label>Reference status</Label>
            <select
              className="w-full border rounded-md p-2 bg-background"
              onChange={e => set('reference_status', e.target.value)}
              defaultValue="in_progress"
            >
              <option value="in_progress">In Progress</option>
              <option value="passed">Passed</option>
              <option value="failed">Failed</option>
            </select>
          </div>
          <div>
            <Label>Offer date</Label>
            <Input type="date" onChange={e => set('offer_date', e.target.value)} />
          </div>
        </>
      )}

      {item.stage === 'offered' && (
        <>
          <div>
            <Label>Target move-in date</Label>
            <Input type="date" onChange={e => set('target_move_in', e.target.value)} />
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea onChange={e => set('notes', e.target.value)} />
          </div>
        </>
      )}

      {item.stage === 'move_in_prep' && (
        <>
          <div>
            <Label>Actual move-in date</Label>
            <Input type="date" onChange={e => set('actual_move_in', e.target.value)} />
          </div>
        </>
      )}

      <Button type="submit" disabled={isPending} className="w-full">
        {next === 'completed' ? 'Complete Letting' : `Move to ${STAGE_LABELS[next!]}`}
      </Button>
    </form>
  );
}

export default function LettingsPipeline() {
  const { data: items, isLoading } = useLettingsPipeline();
  const advanceStage = useAdvanceStage();
  const completeLetting = useCompleteLetting();
  const [advancingItem, setAdvancingItem] = useState<LettingsPipelineItem | null>(null);

  const grouped = useMemo(() => {
    const map: Record<LettingsStage, LettingsPipelineItem[]> = {
      marketing: [],
      viewings: [],
      referencing: [],
      offered: [],
      move_in_prep: [],
      completed: [],
      cancelled: [],
    };
    for (const item of items || []) {
      if (map[item.stage]) map[item.stage].push(item);
    }
    return map;
  }, [items]);

  const totalActive = (items || []).length;

  const handleAdvanceSubmit = (updates: Record<string, any>) => {
    if (!advancingItem) return;

    if (updates.stage === 'completed') {
      completeLetting.mutate({
        id: advancingItem.id,
        actualMoveIn: updates.actual_move_in,
        voidPeriodId: advancingItem.void_period_id,
      }, {
        onSuccess: () => setAdvancingItem(null),
      });
    } else {
      advanceStage.mutate({ id: advancingItem.id, updates }, {
        onSuccess: () => setAdvancingItem(null),
      });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Lettings Pipeline</h1>
            <p className="text-muted-foreground">Track rooms from marketing to move-in</p>
          </div>
          <Badge variant="secondary" className="text-sm">{totalActive} active</Badge>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-center py-12">Loading pipeline…</p>
        ) : totalActive === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-2">No rooms in the pipeline yet.</p>
              <p className="text-sm text-muted-foreground">
                Go to <span className="font-medium">Voids</span> and record a void to start the lettings process.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {KANBAN_STAGES.map(stage => {
              const stageItems = grouped[stage];
              const Icon = STAGE_ICONS[stage] || Home;
              return (
                <div key={stage}>
                  <div className="flex items-center gap-2 mb-3">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold">{STAGE_LABELS[stage]}</h3>
                    <Badge variant="outline" className="text-xs">{stageItems.length}</Badge>
                  </div>
                  <div className={cn(
                    'min-h-[200px] rounded-lg border border-dashed p-2',
                    stageItems.length === 0 && 'flex items-center justify-center'
                  )}>
                    {stageItems.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Empty</p>
                    ) : (
                      stageItems.map(item => (
                        <PipelineCard key={item.id} item={item} onAdvance={setAdvancingItem} />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Sheet open={!!advancingItem} onOpenChange={open => !open && setAdvancingItem(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>
              Advance: {advancingItem?.room?.room_name || 'Room'}
            </SheetTitle>
            <SheetDescription>
              {advancingItem?.property?.address_line_1} — Moving from {advancingItem ? STAGE_LABELS[advancingItem.stage] : ''} to {advancingItem ? STAGE_LABELS[nextStage(advancingItem.stage) || advancingItem.stage] : ''}
            </SheetDescription>
          </SheetHeader>
          {advancingItem && (
            <div className="mt-6">
              <AdvanceForm
                item={advancingItem}
                onSubmit={handleAdvanceSubmit}
                isPending={advanceStage.isPending || completeLetting.isPending}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}
