import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { HardHat, Plus, TrendingUp, ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useCapexProjects, useCreateCapexProject, useAddCapexLineItem, useUpdateCapexProject, useDeleteCapexLineItem, type CapexProject } from '@/hooks/useCapex';

const fmt = (v: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0 }).format(v);

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  planned: { label: 'Planned', variant: 'secondary' },
  in_progress: { label: 'In Progress', variant: 'default' },
  completed: { label: 'Completed', variant: 'outline' },
  on_hold: { label: 'On Hold', variant: 'secondary' },
  cancelled: { label: 'Cancelled', variant: 'destructive' },
};

const CATEGORIES = ['Labour', 'Materials', 'Professional Fees', 'Planning', 'Fixtures & Fittings', 'Utilities', 'Contingency', 'Other'];

export function CapexTracker({ propertyId }: { propertyId: string }) {
  const { data: projects, isLoading } = useCapexProjects(propertyId);
  const createProject = useCreateCapexProject();
  const addLineItem = useAddCapexLineItem();
  const updateProject = useUpdateCapexProject();
  const deleteLineItem = useDeleteCapexLineItem();

  const [showNewProject, setShowNewProject] = useState(false);
  const [showNewItem, setShowNewItem] = useState<string | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  // New project form
  const [projectName, setProjectName] = useState('');
  const [projectDesc, setProjectDesc] = useState('');
  const [projectBudget, setProjectBudget] = useState('');
  const [projectStart, setProjectStart] = useState('');
  const [projectEnd, setProjectEnd] = useState('');

  // New line item form
  const [itemCategory, setItemCategory] = useState('Labour');
  const [itemDesc, setItemDesc] = useState('');
  const [itemBudget, setItemBudget] = useState('');
  const [itemActual, setItemActual] = useState('');
  const [itemSupplier, setItemSupplier] = useState('');

  const handleCreateProject = () => {
    if (!projectName || !projectBudget) return;
    createProject.mutate({
      property_id: propertyId,
      name: projectName,
      description: projectDesc || undefined,
      budget_gbp: parseFloat(projectBudget),
      start_date: projectStart || undefined,
      target_end_date: projectEnd || undefined,
    }, {
      onSuccess: () => {
        setShowNewProject(false);
        setProjectName('');
        setProjectDesc('');
        setProjectBudget('');
        setProjectStart('');
        setProjectEnd('');
      },
    });
  };

  const handleAddLineItem = (projectId: string) => {
    if (!itemDesc || !itemBudget) return;
    addLineItem.mutate({
      project_id: projectId,
      category: itemCategory,
      description: itemDesc,
      budget_gbp: parseFloat(itemBudget),
      actual_gbp: itemActual ? parseFloat(itemActual) : 0,
      supplier: itemSupplier || undefined,
    }, {
      onSuccess: () => {
        setShowNewItem(null);
        setItemCategory('Labour');
        setItemDesc('');
        setItemBudget('');
        setItemActual('');
        setItemSupplier('');
      },
    });
  };

  const toggleProject = (id: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Aggregate totals
  const totalBudget = projects?.reduce((s, p) => s + Number(p.budget_gbp), 0) || 0;
  const totalActual = projects?.reduce((s, p) => {
    const lineTotal = p.line_items?.reduce((ls, li) => ls + Number(li.actual_gbp), 0) || 0;
    return s + lineTotal;
  }, 0) || 0;

  if (isLoading) return null;
  if (!projects?.length && !showNewProject) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <HardHat className="h-5 w-5" />
            Capital Works
          </CardTitle>
          <CardDescription>Track budgets vs actuals for refurbishment and development projects</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => setShowNewProject(true)}>
            <Plus className="h-4 w-4 mr-1" /> New Project
          </Button>
          {renderNewProjectDialog()}
        </CardContent>
      </Card>
    );
  }

  function renderNewProjectDialog() {
    return (
      <Dialog open={showNewProject} onOpenChange={setShowNewProject}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Capex Project</DialogTitle>
            <DialogDescription>Create a project to track budget vs actual spend</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="e.g. Full refurbishment" /></div>
            <div><Label>Budget (£)</Label><Input type="number" value={projectBudget} onChange={e => setProjectBudget(e.target.value)} placeholder="50000" /></div>
            <div><Label>Description (optional)</Label><Textarea value={projectDesc} onChange={e => setProjectDesc(e.target.value)} rows={2} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Start Date</Label><Input type="date" value={projectStart} onChange={e => setProjectStart(e.target.value)} /></div>
              <div><Label>Target End</Label><Input type="date" value={projectEnd} onChange={e => setProjectEnd(e.target.value)} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewProject(false)}>Cancel</Button>
            <Button onClick={handleCreateProject} disabled={!projectName || !projectBudget || createProject.isPending}>
              {createProject.isPending ? 'Creating…' : 'Create Project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <HardHat className="h-5 w-5" />
              Capital Works
            </CardTitle>
            <CardDescription className="mt-1">
              {projects?.length || 0} project(s) — Budget: {fmt(totalBudget)} | Spent: {fmt(totalActual)}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowNewProject(true)}>
            <Plus className="h-4 w-4 mr-1" /> New
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {projects?.map((project) => {
          const items = project.line_items || [];
          const lineActual = items.reduce((s, li) => s + Number(li.actual_gbp), 0);
          const lineBudget = items.reduce((s, li) => s + Number(li.budget_gbp), 0);
          const budget = Number(project.budget_gbp);
          const pct = budget > 0 ? Math.min((lineActual / budget) * 100, 100) : 0;
          const isOver = lineActual > budget;
          const isExpanded = expandedProjects.has(project.id);
          const statusInfo = STATUS_LABELS[project.status] || STATUS_LABELS.planned;

          return (
            <Collapsible key={project.id} open={isExpanded} onOpenChange={() => toggleProject(project.id)}>
              <div className="border rounded-lg p-3">
                <CollapsibleTrigger className="w-full">
                  <div className="flex items-center justify-between text-left">
                    <div className="flex items-center gap-2">
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <span className="font-medium">{project.name}</span>
                      <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                    </div>
                    <div className="text-sm text-right">
                      <span className={isOver ? 'text-destructive font-semibold' : 'text-muted-foreground'}>
                        {fmt(lineActual)}
                      </span>
                      <span className="text-muted-foreground"> / {fmt(budget)}</span>
                    </div>
                  </div>
                  <Progress value={pct} className="mt-2 h-2" />
                </CollapsibleTrigger>

                <CollapsibleContent className="mt-3 space-y-2">
                  {/* Status update */}
                  <div className="flex items-center gap-2">
                    <Label className="text-xs">Status:</Label>
                    <Select value={project.status} onValueChange={(val) => updateProject.mutate({ id: project.id, status: val })}>
                      <SelectTrigger className="h-7 text-xs w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Line items table */}
                  {items.length > 0 && (
                    <div className="border rounded-md overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted">
                          <tr>
                            <th className="text-left px-3 py-1.5 font-medium">Item</th>
                            <th className="text-left px-3 py-1.5 font-medium">Category</th>
                            <th className="text-right px-3 py-1.5 font-medium">Budget</th>
                            <th className="text-right px-3 py-1.5 font-medium">Actual</th>
                            <th className="px-2 py-1.5 w-8"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {items.map((item) => (
                            <tr key={item.id}>
                              <td className="px-3 py-1.5">{item.description}</td>
                              <td className="px-3 py-1.5 text-muted-foreground">{item.category}</td>
                              <td className="px-3 py-1.5 text-right">{fmt(Number(item.budget_gbp))}</td>
                              <td className={`px-3 py-1.5 text-right ${Number(item.actual_gbp) > Number(item.budget_gbp) ? 'text-destructive' : ''}`}>
                                {fmt(Number(item.actual_gbp))}
                              </td>
                              <td className="px-2 py-1.5">
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteLineItem.mutate(item.id)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                          <tr className="bg-muted/50 font-medium">
                            <td className="px-3 py-1.5" colSpan={2}>Total</td>
                            <td className="px-3 py-1.5 text-right">{fmt(lineBudget)}</td>
                            <td className={`px-3 py-1.5 text-right ${isOver ? 'text-destructive' : ''}`}>{fmt(lineActual)}</td>
                            <td></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}

                  <Button variant="outline" size="sm" onClick={() => setShowNewItem(project.id)}>
                    <Plus className="h-3 w-3 mr-1" /> Add Line Item
                  </Button>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}
      </CardContent>

      {renderNewProjectDialog()}

      {/* Add line item dialog */}
      <Dialog open={!!showNewItem} onOpenChange={(open) => { if (!open) setShowNewItem(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Line Item</DialogTitle>
            <DialogDescription>Add a cost item to this project</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Category</Label>
              <Select value={itemCategory} onValueChange={setItemCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Description</Label><Input value={itemDesc} onChange={e => setItemDesc(e.target.value)} placeholder="e.g. Electrician rewire" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Budget (£)</Label><Input type="number" value={itemBudget} onChange={e => setItemBudget(e.target.value)} /></div>
              <div><Label>Actual (£)</Label><Input type="number" value={itemActual} onChange={e => setItemActual(e.target.value)} placeholder="0" /></div>
            </div>
            <div><Label>Supplier (optional)</Label><Input value={itemSupplier} onChange={e => setItemSupplier(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewItem(null)}>Cancel</Button>
            <Button onClick={() => showNewItem && handleAddLineItem(showNewItem)} disabled={!itemDesc || !itemBudget || addLineItem.isPending}>
              {addLineItem.isPending ? 'Adding…' : 'Add Item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
