import { useMemo } from 'react';
import {
  Scale,
  Search,
  PoundSterling,
  ShieldCheck,
  TreePine,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Minus,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { formatGBP } from '@/lib/calculations';
import {
  useDueDiligenceItems,
  useUpdateDDItem,
  useDeals,
  type DDCategory,
  type DDStatus,
  type DueDiligenceItem,
} from '@/hooks/useDealPipeline';

const CATEGORY_CONFIG: Record<DDCategory, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  legal: { label: 'Legal', icon: Scale },
  survey: { label: 'Survey', icon: Search },
  financial: { label: 'Financial', icon: PoundSterling },
  compliance: { label: 'Compliance', icon: ShieldCheck },
  planning: { label: 'Planning', icon: AlertTriangle },
  environmental: { label: 'Environmental', icon: TreePine },
};

const STATUS_CONFIG: Record<DDStatus, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  pending: { label: 'Pending', icon: Clock, color: 'text-muted-foreground' },
  in_progress: { label: 'In Progress', icon: AlertTriangle, color: 'text-amber-600' },
  passed: { label: 'Passed', icon: CheckCircle2, color: 'text-emerald-600' },
  failed: { label: 'Failed', icon: XCircle, color: 'text-destructive' },
  'n/a': { label: 'N/A', icon: Minus, color: 'text-muted-foreground' },
};

function DDItemRow({ item }: { item: DueDiligenceItem }) {
  const updateItem = useUpdateDDItem();
  const StatusIcon = STATUS_CONFIG[item.status].icon;

  return (
    <div className="flex items-center gap-3 py-2 border-b last:border-0">
      <StatusIcon
        className={`h-4 w-4 shrink-0 ${STATUS_CONFIG[item.status].color}`}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.item_name}</p>
        {item.notes && (
          <p className="text-xs text-muted-foreground truncate">{item.notes}</p>
        )}
      </div>

      {/* Assigned */}
      <Input
        placeholder="Assigned to"
        className="w-28 h-7 text-xs"
        value={item.assigned_to || ''}
        onChange={e =>
          updateItem.mutate({
            id: item.id,
            updates: { assigned_to: e.target.value || null },
          })
        }
      />

      {/* Cost */}
      <Input
        type="number"
        placeholder="Cost"
        className="w-20 h-7 text-xs"
        value={item.cost ?? ''}
        onChange={e =>
          updateItem.mutate({
            id: item.id,
            updates: { cost: e.target.value ? Number(e.target.value) : null },
          })
        }
      />

      {/* Status select */}
      <Select
        value={item.status}
        onValueChange={v =>
          updateItem.mutate({ id: item.id, updates: { status: v as DDStatus } })
        }
      >
        <SelectTrigger className="w-28 h-7 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <SelectItem key={key} value={key}>
              {cfg.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

interface DueDiligenceChecklistProps {
  dealId?: string | null;
}

export function DueDiligenceChecklist({ dealId }: DueDiligenceChecklistProps) {
  const { data: deals } = useDeals({ stages: ['due_diligence'] });
  const selectedDealId = dealId || (deals && deals.length > 0 ? deals[0].id : null);
  const { data: items, isLoading } = useDueDiligenceItems(selectedDealId);

  const grouped = useMemo(() => {
    const map: Record<DDCategory, DueDiligenceItem[]> = {
      legal: [],
      survey: [],
      financial: [],
      compliance: [],
      planning: [],
      environmental: [],
    };
    for (const item of items || []) {
      if (map[item.category]) map[item.category].push(item);
    }
    return map;
  }, [items]);

  const progress = useMemo(() => {
    if (!items || items.length === 0) return { completed: 0, total: 0, percent: 0, totalCost: 0 };
    const completed = items.filter(i => i.status === 'passed' || i.status === 'n/a').length;
    const totalCost = items.reduce((sum, i) => sum + (i.cost || 0), 0);
    return {
      completed,
      total: items.length,
      percent: Math.round((completed / items.length) * 100),
      totalCost,
    };
  }, [items]);

  const selectedDeal = deals?.find(d => d.id === selectedDealId);

  if (!deals || deals.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <ClipboardCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No Active Due Diligence</h3>
          <p className="text-muted-foreground">
            Move a deal to the "Due Diligence" stage to start the checklist.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Deal selector if multiple */}
      {deals.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Deal:</span>
          {deals.map(d => (
            <Button
              key={d.id}
              size="sm"
              variant={d.id === selectedDealId ? 'default' : 'outline'}
              onClick={() => {/* re-render with new dealId handled by parent */}}
            >
              {d.address}
            </Button>
          ))}
        </div>
      )}

      {/* Progress */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="font-medium">
                {selectedDeal?.address || 'Due Diligence'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {progress.completed} of {progress.total} complete
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Total DD Cost</p>
              <p className="font-medium">{formatGBP(progress.totalCost)}</p>
            </div>
          </div>
          <Progress value={progress.percent} className="h-2" />
        </CardContent>
      </Card>

      {/* Category accordions */}
      {isLoading ? (
        <p className="text-center text-muted-foreground py-8">Loading checklist...</p>
      ) : (
        <Accordion type="multiple" defaultValue={Object.keys(CATEGORY_CONFIG)}>
          {(Object.keys(CATEGORY_CONFIG) as DDCategory[]).map(category => {
            const config = CATEGORY_CONFIG[category];
            const categoryItems = grouped[category];
            const done = categoryItems.filter(
              i => i.status === 'passed' || i.status === 'n/a'
            ).length;
            const Icon = config.icon;

            return (
              <AccordionItem key={category} value={category}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{config.label}</span>
                    <Badge variant="outline" className="text-xs">
                      {done}/{categoryItems.length}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-0">
                    {categoryItems.map(item => (
                      <DDItemRow key={item.id} item={item} />
                    ))}
                    {categoryItems.length === 0 && (
                      <p className="text-sm text-muted-foreground py-2">
                        No items in this category.
                      </p>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
    </div>
  );
}

function ClipboardCheck(props: { className?: string }) {
  return <CheckCircle2 {...props} />;
}
