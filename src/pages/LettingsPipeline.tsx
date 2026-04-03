import { useState, useMemo } from 'react';
import { differenceInDays, format } from 'date-fns';
import { ArrowRight, Home, Users, ClipboardCheck, Gift, Key, AlertTriangle } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { formatGBP } from '@/lib/calculations';
import { ReferencingPanel } from '@/components/lettings/ReferencingPanel';
import { TenancyAgreementGenerator } from '@/components/lettings/TenancyAgreementGenerator';
import { MoveInChecklist } from '@/components/lettings/MoveInChecklist';
import { ViewingScheduler } from '@/components/lettings/ViewingScheduler';
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
import { useTenantReferences } from '@/hooks/useLettingsWorkflow';
import { useToast } from '@/hooks/use-toast';

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

function PipelineCard({
  item,
  onClick,
}: {
  item: LettingsPipelineItem;
  onClick: (item: LettingsPipelineItem) => void;
}) {
  const roomLabel = item.room?.room_name || 'Room';
  const address = item.property ? `${item.property.address_line_1}` : '';

  const stageInfo = () => {
    switch (item.stage) {
      case 'marketing':
        return item.advertised_rent ? `${formatGBP(item.advertised_rent)}/mo` : null;
      case 'viewings':
        return `${item.total_viewings} viewing${item.total_viewings !== 1 ? 's' : ''}`;
      case 'referencing':
        return item.reference_status === 'in_progress' ? 'In progress' : item.reference_status === 'passed' ? 'Passed' : item.reference_status || null;
      case 'offered':
        return item.offered_to_name || null;
      case 'move_in_prep':
        return item.target_move_in ? `Move-in ${format(new Date(item.target_move_in), 'dd MMM')}` : null;
      default:
        return null;
    }
  };

  return (
    <Card
      className="mb-3 hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onClick(item)}
    >
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
      </CardContent>
    </Card>
  );
}

// Stage-specific default tab mapping
function defaultTabForStage(stage: LettingsStage): string {
  switch (stage) {
    case 'marketing': return 'details';
    case 'viewings': return 'viewings';
    case 'referencing': return 'referencing';
    case 'offered': return 'agreement';
    case 'move_in_prep': return 'checklist';
    default: return 'details';
  }
}

// Advance validation
function canAdvance(item: LettingsPipelineItem, refStatus: string | null): { allowed: boolean; reason?: string } {
  const next = nextStage(item.stage);
  if (!next) return { allowed: false, reason: 'Already at final stage' };

  if (item.stage === 'referencing' && refStatus !== 'approved') {
    return { allowed: false, reason: 'References must be approved before advancing' };
  }

  return { allowed: true };
}

function DetailSheet({
  item,
  onClose,
}: {
  item: LettingsPipelineItem;
  onClose: () => void;
}) {
  const advanceStage = useAdvanceStage();
  const completeLetting = useCompleteLetting();
  const { data: ref } = useTenantReferences(item.id);
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState(defaultTabForStage(item.stage));

  const next = nextStage(item.stage);
  const validation = canAdvance(item, ref?.overall_status ?? null);

  const handleAdvance = () => {
    if (!next) return;
    if (!validation.allowed) {
      toast({ title: 'Cannot advance', description: validation.reason, variant: 'destructive' });
      return;
    }

    if (next === 'completed') {
      completeLetting.mutate({
        id: item.id,
        actualMoveIn: item.actual_move_in ?? undefined,
        voidPeriodId: item.void_period_id,
      }, { onSuccess: onClose });
    } else {
      advanceStage.mutate({
        id: item.id,
        updates: { stage: next },
      }, { onSuccess: onClose });
    }
  };

  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2">
          {item.room?.room_name || 'Room'} — {STAGE_LABELS[item.stage]}
        </SheetTitle>
        <SheetDescription>
          {item.property?.address_line_1}
          {item.offered_to_name ? ` — ${item.offered_to_name}` : ''}
        </SheetDescription>
      </SheetHeader>

      <div className="mt-4 flex-1 overflow-y-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full">
            <TabsTrigger value="details" className="flex-1 text-xs">Details</TabsTrigger>
            <TabsTrigger value="viewings" className="flex-1 text-xs">Viewings</TabsTrigger>
            <TabsTrigger value="referencing" className="flex-1 text-xs">References</TabsTrigger>
            <TabsTrigger value="agreement" className="flex-1 text-xs">Agreement</TabsTrigger>
            <TabsTrigger value="checklist" className="flex-1 text-xs">Move-In</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Property</p>
                <p className="font-medium">{item.property?.address_line_1}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Room</p>
                <p className="font-medium">{item.room?.room_name || '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Advertised Rent</p>
                <p className="font-medium">{item.advertised_rent ? formatGBP(item.advertised_rent) + '/mo' : '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Offered Rent</p>
                <p className="font-medium">{item.offered_rent ? formatGBP(item.offered_rent) + '/mo' : '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Enquiries</p>
                <p className="font-medium">{item.total_enquiries}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Viewings</p>
                <p className="font-medium">{item.total_viewings}</p>
              </div>
              {item.offered_to_name && (
                <>
                  <div>
                    <p className="text-muted-foreground text-xs">Offered To</p>
                    <p className="font-medium">{item.offered_to_name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Email</p>
                    <p className="font-medium">{item.offered_to_email || '—'}</p>
                  </div>
                </>
              )}
              {item.target_move_in && (
                <div>
                  <p className="text-muted-foreground text-xs">Target Move-in</p>
                  <p className="font-medium">{format(new Date(item.target_move_in), 'dd MMM yyyy')}</p>
                </div>
              )}
              {item.notes && (
                <div className="col-span-2">
                  <p className="text-muted-foreground text-xs">Notes</p>
                  <p className="text-sm">{item.notes}</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="viewings" className="mt-4">
            <ViewingScheduler item={item} />
          </TabsContent>

          <TabsContent value="referencing" className="mt-4">
            <ReferencingPanel item={item} />
          </TabsContent>

          <TabsContent value="agreement" className="mt-4">
            <TenancyAgreementGenerator item={item} />
          </TabsContent>

          <TabsContent value="checklist" className="mt-4">
            <MoveInChecklist item={item} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Advance button */}
      {next && (
        <div className="mt-4 pt-4 border-t space-y-2">
          {!validation.allowed && (
            <div className="flex items-center gap-2 text-sm text-orange-600 bg-orange-50 dark:bg-orange-950/20 rounded-lg p-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span>{validation.reason}</span>
            </div>
          )}
          <Button
            className="w-full"
            disabled={!validation.allowed || advanceStage.isPending || completeLetting.isPending}
            onClick={handleAdvance}
          >
            {next === 'completed' ? 'Complete Letting' : `Advance to ${STAGE_LABELS[next]}`}
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </>
  );
}

export default function LettingsPipeline() {
  const { data: items, isLoading } = useLettingsPipeline();
  const [selectedItem, setSelectedItem] = useState<LettingsPipelineItem | null>(null);

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
                        <PipelineCard key={item.id} item={item} onClick={setSelectedItem} />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Sheet open={!!selectedItem} onOpenChange={open => !open && setSelectedItem(null)}>
        <SheetContent className="sm:max-w-xl overflow-y-auto flex flex-col">
          {selectedItem && (
            <DetailSheet item={selectedItem} onClose={() => setSelectedItem(null)} />
          )}
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}
