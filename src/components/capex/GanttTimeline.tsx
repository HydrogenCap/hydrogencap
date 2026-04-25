import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { differenceInDays, format, parseISO, isAfter } from 'date-fns';
import { useCapexPhases, useCreateCapexPhase, type CapexPhase } from '@/hooks/useCapexUpgrade';

const fmt = (v: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0 }).format(v);

function phaseColor(phase: CapexPhase): string {
  if (phase.status === 'completed') return '#94a3b8'; // grey
  if (phase.status === 'delayed') return '#f59e0b'; // amber
  if (phase.actual_end && phase.planned_end && isAfter(parseISO(phase.actual_end), parseISO(phase.planned_end))) return '#ef4444'; // red
  if (!phase.actual_end && phase.planned_end && isAfter(new Date(), parseISO(phase.planned_end))) return '#ef4444'; // overdue
  return '#22c55e'; // green — on track
}

export default function GanttTimeline({ projectId }: { projectId: string }) {
  const { data: phases = [], isLoading } = useCapexPhases(projectId);
  const [showAdd, setShowAdd] = useState(false);
  const [hoveredPhase, setHoveredPhase] = useState<string | null>(null);

  const { timelineStart, timelineEnd: _timelineEnd, totalDays } = useMemo(() => {
    if (phases.length === 0) {
      const now = new Date();
      return { timelineStart: now, timelineEnd: now, totalDays: 1 };
    }
    const dates = phases.flatMap(p => [p.planned_start, p.planned_end, p.actual_start, p.actual_end].filter(Boolean) as string[]);
    const parsed = dates.map(d => parseISO(d));
    const min = new Date(Math.min(...parsed.map(d => d.getTime())));
    const max = new Date(Math.max(...parsed.map(d => d.getTime()), Date.now()));
    const days = Math.max(differenceInDays(max, min), 1);
    return { timelineStart: min, timelineEnd: max, totalDays: days };
  }, [phases]);

  const todayPct = Math.max(0, Math.min(100, (differenceInDays(new Date(), timelineStart) / totalDays) * 100));

  const getBarStyle = (start: string | null, end: string | null) => {
    if (!start || !end) return { left: '0%', width: '0%' };
    const s = differenceInDays(parseISO(start), timelineStart);
    const e = differenceInDays(parseISO(end), timelineStart);
    const left = Math.max(0, (s / totalDays) * 100);
    const width = Math.max(1, ((e - s) / totalDays) * 100);
    return { left: `${left}%`, width: `${width}%` };
  };

  // Build dependency map for arrows
  const phaseMap = useMemo(() => new Map(phases.map(p => [p.id, p])), [phases]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Project Timeline</CardTitle>
        <Button variant="outline" size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="h-3 w-3 mr-1" /> Add Phase
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : phases.length === 0 ? (
          <p className="text-sm text-muted-foreground">No phases defined yet. Add phases to see the Gantt chart.</p>
        ) : (
          <div className="space-y-1">
            {/* Month labels */}
            <div className="flex text-xs text-muted-foreground mb-2 ml-40 relative h-5">
              {Array.from({ length: Math.min(Math.ceil(totalDays / 30) + 1, 24) }).map((_, i) => {
                const d = new Date(timelineStart);
                d.setDate(d.getDate() + i * 30);
                const pct = (i * 30 / totalDays) * 100;
                if (pct > 100) return null;
                return (
                  <span key={i} className="absolute whitespace-nowrap" style={{ left: `${pct}%` }}>
                    {format(d, 'MMM yy')}
                  </span>
                );
              })}
            </div>

            {/* Phase rows */}
            {phases.map((phase) => {
              const planned = getBarStyle(phase.planned_start, phase.planned_end);
              const actual = getBarStyle(phase.actual_start || phase.planned_start, phase.actual_end || (phase.status === 'in_progress' ? new Date().toISOString().split('T')[0] : phase.planned_end));
              const color = phaseColor(phase);
              const dep = phase.depends_on_phase_id ? phaseMap.get(phase.depends_on_phase_id) : null;

              return (
                <div
                  key={phase.id}
                  className="flex items-center gap-2 h-10 group"
                  onMouseEnter={() => setHoveredPhase(phase.id)}
                  onMouseLeave={() => setHoveredPhase(null)}
                >
                  {/* Phase label */}
                  <div className="w-40 shrink-0 text-sm truncate font-medium flex items-center gap-1">
                    {dep && <span className="text-muted-foreground text-xs">↳</span>}
                    {phase.phase_name}
                  </div>

                  {/* Bar area */}
                  <div className="relative flex-1 h-8 bg-muted/30 rounded">
                    {/* Today marker */}
                    <div
                      className="absolute top-0 bottom-0 w-px border-l-2 border-dashed border-blue-400 z-10"
                      style={{ left: `${todayPct}%` }}
                    />

                    {/* Planned bar (outline) */}
                    <div
                      className="absolute top-1 h-6 rounded border-2 border-dashed opacity-40"
                      style={{ ...planned, borderColor: color }}
                    />

                    {/* Actual bar (filled) */}
                    <div
                      className="absolute top-1 h-6 rounded opacity-80"
                      style={{ ...actual, backgroundColor: color }}
                    />

                    {/* Dependency arrow */}
                    {dep && (
                      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: 'visible' }}>
                        <defs>
                          <marker id={`arrow-${phase.id}`} viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                            <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
                          </marker>
                        </defs>
                        {(() => {
                          const depEnd = dep.planned_end || dep.actual_end;
                          if (!depEnd || !phase.planned_start) return null;
                          const x1Pct = (differenceInDays(parseISO(depEnd), timelineStart) / totalDays) * 100;
                          const x2Pct = (differenceInDays(parseISO(phase.planned_start), timelineStart) / totalDays) * 100;
                          return (
                            <line
                              x1={`${x1Pct}%`} y1="50%"
                              x2={`${x2Pct}%`} y2="50%"
                              stroke="#94a3b8" strokeWidth="1.5"
                              markerEnd={`url(#arrow-${phase.id})`}
                            />
                          );
                        })()}
                      </svg>
                    )}

                    {/* Hover tooltip */}
                    {hoveredPhase === phase.id && (
                      <div className="absolute z-20 -top-24 left-1/2 -translate-x-1/2 bg-popover border rounded-md shadow-md p-3 text-xs w-56">
                        <p className="font-semibold mb-1">{phase.phase_name}</p>
                        <p>Planned: {phase.planned_start ? format(parseISO(phase.planned_start), 'dd MMM') : '—'} – {phase.planned_end ? format(parseISO(phase.planned_end), 'dd MMM') : '—'}</p>
                        {phase.actual_start && <p>Actual start: {format(parseISO(phase.actual_start), 'dd MMM')}</p>}
                        <p>Budget: {fmt(Number(phase.budget))} | Actual: {fmt(Number(phase.actual_cost))}</p>
                        <Badge variant={phase.status === 'completed' ? 'outline' : phase.status === 'delayed' ? 'destructive' : 'default'} className="mt-1">
                          {phase.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    )}
                  </div>

                  {/* Status badge */}
                  <Badge
                    variant={phase.status === 'completed' ? 'outline' : phase.status === 'delayed' ? 'destructive' : 'default'}
                    className="shrink-0 w-20 justify-center text-xs"
                  >
                    {phase.status.replace('_', ' ')}
                  </Badge>
                </div>
              );
            })}

            {/* Legend */}
            <div className="flex gap-4 pt-3 text-xs text-muted-foreground border-t mt-3">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500 inline-block" /> On track</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-500 inline-block" /> Delayed</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500 inline-block" /> Overdue</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-slate-400 inline-block" /> Completed</span>
              <span className="flex items-center gap-1"><span className="w-px h-3 border-l-2 border-dashed border-blue-400 inline-block" /> Today</span>
            </div>
          </div>
        )}
      </CardContent>

      <AddPhaseDialog open={showAdd} onOpenChange={setShowAdd} projectId={projectId} phases={phases} />
    </Card>
  );
}

function AddPhaseDialog({ open, onOpenChange, projectId, phases }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  phases: CapexPhase[];
}) {
  const create = useCreateCapexPhase();
  const [name, setName] = useState('');
  const [plannedStart, setPlannedStart] = useState('');
  const [plannedEnd, setPlannedEnd] = useState('');
  const [budget, setBudget] = useState('');
  const [dependsOn, setDependsOn] = useState('');

  const handleCreate = () => {
    if (!name) return;
    create.mutate({
      project_id: projectId,
      phase_name: name,
      planned_start: plannedStart || null,
      planned_end: plannedEnd || null,
      actual_start: null,
      actual_end: null,
      status: 'planned',
      budget: budget ? parseFloat(budget) : 0,
      actual_cost: 0,
      depends_on_phase_id: dependsOn || null,
      sort_order: phases.length,
    }, {
      onSuccess: () => {
        onOpenChange(false);
        setName('');
        setPlannedStart('');
        setPlannedEnd('');
        setBudget('');
        setDependsOn('');
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Phase</DialogTitle>
          <DialogDescription>Add a project phase to the timeline</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label>Phase Name</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Demolition" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Planned Start</Label><Input type="date" value={plannedStart} onChange={e => setPlannedStart(e.target.value)} /></div>
            <div><Label>Planned End</Label><Input type="date" value={plannedEnd} onChange={e => setPlannedEnd(e.target.value)} /></div>
          </div>
          <div><Label>Phase Budget (£)</Label><Input type="number" value={budget} onChange={e => setBudget(e.target.value)} /></div>
          {phases.length > 0 && (
            <div>
              <Label>Depends On</Label>
              <Select value={dependsOn} onValueChange={setDependsOn}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {phases.map(p => <SelectItem key={p.id} value={p.id}>{p.phase_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={!name || create.isPending}>
            {create.isPending ? 'Adding...' : 'Add Phase'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
