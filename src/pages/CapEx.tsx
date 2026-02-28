import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { HardHat, Plus, ChevronDown, ChevronRight, Briefcase, TrendingUp, PoundSterling, AlertTriangle } from 'lucide-react';
import { useAllCapexProjects, useCreateCapexProjectFull, CAPEX_TEMPLATES, type CapexProjectWithProperty } from '@/hooks/useCapexAll';
import { useAddCapexLineItem } from '@/hooks/useCapex';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchUserOrgId } from '@/hooks/useUserOrg';

const fmt = (v: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0 }).format(v);

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  planned: { label: 'Planned', variant: 'secondary' },
  draft: { label: 'Draft', variant: 'secondary' },
  in_progress: { label: 'In Progress', variant: 'default' },
  complete: { label: 'Complete', variant: 'outline' },
  completed: { label: 'Completed', variant: 'outline' },
  on_hold: { label: 'On Hold', variant: 'secondary' },
  cancelled: { label: 'Cancelled', variant: 'destructive' },
};

export default function CapExPage() {
  const { data: projects, isLoading } = useAllCapexProjects();
  const navigate = useNavigate();
  const [showNewProject, setShowNewProject] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);

  const activeProjects = projects?.filter(p => !['complete', 'completed', 'cancelled'].includes(p.status)) || [];
  const completedProjects = projects?.filter(p => ['complete', 'completed'].includes(p.status)) || [];

  const totalBudget = activeProjects.reduce((s, p) => s + Number(p.budget_gbp), 0);
  const totalSpent = activeProjects.reduce((s, p) => {
    const lineTotal = (p.line_items || []).reduce((ls, li) => ls + Number(li.actual_gbp), 0);
    return s + lineTotal;
  }, 0);
  const totalRemaining = totalBudget - totalSpent;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <HardHat className="h-6 w-6" /> Capital Expenditure
          </h1>
          <p className="text-muted-foreground mt-1">Track budgets and spend across refurbishment projects</p>
        </div>
        <Button onClick={() => setShowNewProject(true)}>
          <Plus className="h-4 w-4 mr-1" /> New Project
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard icon={Briefcase} label="Active Projects" value={activeProjects.length.toString()} />
        <KPICard icon={PoundSterling} label="Total Budget" value={fmt(totalBudget)} />
        <KPICard icon={TrendingUp} label="Total Spent" value={fmt(totalSpent)} />
        <KPICard icon={AlertTriangle} label="Remaining" value={fmt(totalRemaining)} className={totalRemaining < 0 ? 'text-destructive' : ''} />
      </div>

      {/* Active Projects Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active Projects</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : activeProjects.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active projects</p>
          ) : (
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Property</th>
                    <th className="text-left px-3 py-2 font-medium">Project</th>
                    <th className="text-right px-3 py-2 font-medium">Budget</th>
                    <th className="text-right px-3 py-2 font-medium">Spent</th>
                    <th className="px-3 py-2 font-medium">Progress</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {activeProjects.map(p => {
                    const spent = (p.line_items || []).reduce((s, li) => s + Number(li.actual_gbp), 0);
                    const budget = Number(p.budget_gbp);
                    const pct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
                    const statusInfo = STATUS_LABELS[p.status] || STATUS_LABELS.planned;
                    return (
                      <tr key={p.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/capex/${p.id}`)}>
                        <td className="px-3 py-2">{p.properties?.address_line_1 || '—'}</td>
                        <td className="px-3 py-2 font-medium">{p.name}</td>
                        <td className="px-3 py-2 text-right">{fmt(budget)}</td>
                        <td className={`px-3 py-2 text-right ${spent > budget ? 'text-destructive font-semibold' : ''}`}>{fmt(spent)}</td>
                        <td className="px-3 py-2 w-32"><Progress value={pct} className="h-2" /></td>
                        <td className="px-3 py-2"><Badge variant={statusInfo.variant}>{statusInfo.label}</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Completed Projects */}
      {completedProjects.length > 0 && (
        <Collapsible open={showCompleted} onOpenChange={setShowCompleted}>
          <Card>
            <CardHeader>
              <CollapsibleTrigger className="flex items-center gap-2 w-full text-left">
                {showCompleted ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <CardTitle className="text-base">Completed Projects ({completedProjects.length})</CardTitle>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent>
                <div className="border rounded-md overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Property</th>
                        <th className="text-left px-3 py-2 font-medium">Project</th>
                        <th className="text-right px-3 py-2 font-medium">Budget</th>
                        <th className="text-right px-3 py-2 font-medium">Final Cost</th>
                        <th className="text-right px-3 py-2 font-medium">Variance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {completedProjects.map(p => {
                        const spent = (p.line_items || []).reduce((s, li) => s + Number(li.actual_gbp), 0);
                        const budget = Number(p.budget_gbp);
                        const variance = budget - spent;
                        return (
                          <tr key={p.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/capex/${p.id}`)}>
                            <td className="px-3 py-2">{p.properties?.address_line_1 || '—'}</td>
                            <td className="px-3 py-2 font-medium">{p.name}</td>
                            <td className="px-3 py-2 text-right">{fmt(budget)}</td>
                            <td className="px-3 py-2 text-right">{fmt(spent)}</td>
                            <td className={`px-3 py-2 text-right ${variance < 0 ? 'text-destructive' : 'text-green-600'}`}>
                              {variance >= 0 ? '+' : ''}{fmt(variance)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      <NewProjectDialog open={showNewProject} onOpenChange={setShowNewProject} />
    </div>
  );
}

function KPICard({ icon: Icon, label, value, className }: { icon: any; label: string; value: string; className?: string }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className={`text-lg font-bold ${className || ''}`}>{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function NewProjectDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const createProject = useCreateCapexProjectFull();
  const addLineItem = useAddCapexLineItem();
  const [propertyId, setPropertyId] = useState('');
  const [name, setName] = useState('');
  const [budget, setBudget] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [desc, setDesc] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const navigate = useNavigate();

  const { data: properties } = useQuery({
    queryKey: ['properties-for-capex'],
    enabled: open,
    queryFn: async () => {
      const orgId = await fetchUserOrgId();
      const { data } = await supabase.from('properties_v2').select('id, address_line_1').eq('org_id', orgId).order('address_line_1');
      return data || [];
    },
  });

  const handleCreate = async () => {
    if (!propertyId || !name || !budget) return;
    const result = await createProject.mutateAsync({
      property_id: propertyId,
      name,
      budget_gbp: parseFloat(budget),
      start_date: startDate || undefined,
      target_end_date: endDate || undefined,
      description: desc || undefined,
    });

    // Add template items
    if (selectedTemplate && CAPEX_TEMPLATES[selectedTemplate]) {
      for (const item of CAPEX_TEMPLATES[selectedTemplate]) {
        await addLineItem.mutateAsync({
          project_id: result.id,
          category: item.category,
          description: item.description,
          budget_gbp: 0,
          actual_gbp: 0,
        });
      }
    }

    onOpenChange(false);
    navigate(`/capex/${result.id}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New CapEx Project</DialogTitle>
          <DialogDescription>Create a project to track refurbishment spend</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Property</Label>
            <Select value={propertyId} onValueChange={v => {
              setPropertyId(v);
              const prop = properties?.find(p => p.id === v);
              if (prop && !name) setName(`Refurbishment — ${prop.address_line_1}`);
            }}>
              <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
              <SelectContent>
                {properties?.map(p => <SelectItem key={p.id} value={p.id}>{p.address_line_1}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Project Name</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
          <div><Label>Total Budget (£)</Label><Input type="number" value={budget} onChange={e => setBudget(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Start Date</Label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
            <div><Label>Target End</Label><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
          </div>
          <div><Label>Scope Notes</Label><Textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} /></div>
          <div>
            <Label>Quick-add Template (optional)</Label>
            <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {Object.keys(CAPEX_TEMPLATES).map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={!propertyId || !name || !budget || createProject.isPending}>
            {createProject.isPending ? 'Creating…' : 'Create Project'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
