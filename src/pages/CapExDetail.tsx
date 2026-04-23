import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HardHat, Plus, Trash2, ArrowLeft, CheckCircle, BarChart3, Clock, PoundSterling, Camera, FileText } from 'lucide-react';
import { useCapexProject, useCompleteCapexProject } from '@/hooks/useCapexAll';
import { useAddCapexLineItem, useUpdateCapexLineItem, useDeleteCapexLineItem, useUpdateCapexProject } from '@/hooks/useCapex';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { differenceInDays, format, isPast } from 'date-fns';
import GanttTimeline from '@/components/capex/GanttTimeline';
import CostVarianceTracker from '@/components/capex/CostVarianceTracker';
import ContractorPaymentSchedule from '@/components/capex/ContractorPaymentSchedule';
import PhotoJournal from '@/components/capex/PhotoJournal';
import PlanningTracker from '@/components/capex/PlanningTracker';

const fmt = (v: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0 }).format(v);

const CATEGORIES = ['Labour', 'Materials', 'Professional Fees', 'Planning', 'Fixtures & Fittings', 'Utilities', 'Contingency', 'Other'];
const PIE_COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#6366f1', '#64748b'];

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  planned: { label: 'Planned', variant: 'secondary' },
  draft: { label: 'Draft', variant: 'secondary' },
  in_progress: { label: 'In Progress', variant: 'default' },
  complete: { label: 'Complete', variant: 'outline' },
  completed: { label: 'Completed', variant: 'outline' },
  on_hold: { label: 'On Hold', variant: 'secondary' },
  cancelled: { label: 'Cancelled', variant: 'destructive' },
};

export default function CapExDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: project, isLoading } = useCapexProject(id!);
  const updateProject = useUpdateCapexProject();
  const addLineItem = useAddCapexLineItem();
  const updateLineItem = useUpdateCapexLineItem();
  const deleteLineItem = useDeleteCapexLineItem();
  const completeProject = useCompleteCapexProject();

  const [showAddItem, setShowAddItem] = useState(false);
  const [itemCategory, setItemCategory] = useState('Labour');
  const [itemDesc, setItemDesc] = useState('');
  const [itemBudget, setItemBudget] = useState('');
  const [itemActual, setItemActual] = useState('');
  const [itemSupplier, setItemSupplier] = useState('');

  if (isLoading) return <div className="container mx-auto p-6">Loading...</div>;
  if (!project) return <div className="container mx-auto p-6">Project not found</div>;

  const items = project.line_items || [];
  const totalBudget = Number(project.budget_gbp);
  const totalSpent = items.reduce((s, li) => s + Number(li.actual_gbp), 0);
  const lineBudget = items.reduce((s, li) => s + Number(li.budget_gbp), 0);
  const pct = totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0;
  const isOver = totalSpent > totalBudget;

  // Timeline
  const overdueDays = project.target_end_date && isPast(new Date(project.target_end_date))
    ? differenceInDays(new Date(), new Date(project.target_end_date))
    : 0;

  // All items effectively done?
  const allItemsDone = items.length > 0 && items.every(li => Number(li.actual_gbp) > 0);
  const showCompleteBanner = allItemsDone && !['complete', 'completed', 'cancelled'].includes(project.status);

  // Chart data
  const barData = items.map(li => ({
    name: li.description.length > 20 ? li.description.slice(0, 20) + '...' : li.description,
    Budget: Number(li.budget_gbp),
    Actual: Number(li.actual_gbp),
  }));

  const categoryData = CATEGORIES.map(cat => {
    const total = items.filter(li => li.category === cat).reduce((s, li) => s + Number(li.actual_gbp), 0);
    return { name: cat, value: total };
  }).filter(d => d.value > 0);

  const handleAddItem = () => {
    if (!itemDesc || !itemBudget) return;
    addLineItem.mutate({
      project_id: id!,
      category: itemCategory,
      description: itemDesc,
      budget_gbp: parseFloat(itemBudget),
      actual_gbp: itemActual ? parseFloat(itemActual) : 0,
      supplier: itemSupplier || undefined,
    }, {
      onSuccess: () => {
        setShowAddItem(false);
        setItemCategory('Labour');
        setItemDesc('');
        setItemBudget('');
        setItemActual('');
        setItemSupplier('');
      },
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link to="/capex" className="text-sm text-muted-foreground flex items-center gap-1 mb-2 hover:underline">
            <ArrowLeft className="h-3 w-3" /> Back to CapEx
          </Link>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <HardHat className="h-6 w-6" />
            {project.name}
          </h1>
          <p className="text-muted-foreground">
            {project.properties?.address_line_1}
            {project.properties?.city ? `, ${project.properties.city}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={project.status} onValueChange={(val) => updateProject.mutate({ id: project.id, status: val })}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Budget progress */}
      <Card>
        <CardContent className="p-4">
          <div className="flex justify-between text-sm mb-2">
            <span className={isOver ? 'text-destructive font-semibold' : ''}>{fmt(totalSpent)} spent</span>
            <span className="text-muted-foreground">{fmt(totalBudget)} budget</span>
          </div>
          <Progress value={pct} className="h-3" />
          <div className="flex justify-between text-xs text-muted-foreground mt-2">
            {project.start_date && <span>Start: {format(new Date(project.start_date), 'dd MMM yyyy')}</span>}
            {project.target_end_date && (
              <span className={overdueDays > 0 ? 'text-destructive font-semibold' : ''}>
                Target: {format(new Date(project.target_end_date), 'dd MMM yyyy')}
                {overdueDays > 0 && ` (${overdueDays} days overdue)`}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Complete banner */}
      {showCompleteBanner && (
        <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium">All items complete!</p>
                <p className="text-xs text-muted-foreground">
                  Final cost: {fmt(totalSpent)} ({isOver ? fmt(totalSpent - totalBudget) + ' over' : fmt(totalBudget - totalSpent) + ' under'} budget)
                </p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => completeProject.mutate({ projectId: project.id, propertyId: project.property_id })}
              disabled={completeProject.isPending}
            >
              Complete Project & Update Lifecycle
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Tabbed content */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="overview" className="gap-1"><BarChart3 className="h-3 w-3" /> Overview</TabsTrigger>
          <TabsTrigger value="timeline" className="gap-1"><Clock className="h-3 w-3" /> Timeline</TabsTrigger>
          <TabsTrigger value="costs" className="gap-1"><PoundSterling className="h-3 w-3" /> Costs</TabsTrigger>
          <TabsTrigger value="payments" className="gap-1"><PoundSterling className="h-3 w-3" /> Payments</TabsTrigger>
          <TabsTrigger value="photos" className="gap-1"><Camera className="h-3 w-3" /> Photos</TabsTrigger>
          <TabsTrigger value="planning" className="gap-1"><FileText className="h-3 w-3" /> Planning</TabsTrigger>
        </TabsList>

        {/* Overview Tab — existing content */}
        <TabsContent value="overview" className="space-y-6">
          {/* Line items table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Line Items</CardTitle>
              <Button variant="outline" size="sm" onClick={() => setShowAddItem(true)}>
                <Plus className="h-3 w-3 mr-1" /> Add Item
              </Button>
            </CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">No line items yet</p>
              ) : (
                <div className="border rounded-md overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Item</th>
                        <th className="text-left px-3 py-2 font-medium">Category</th>
                        <th className="text-left px-3 py-2 font-medium">Supplier</th>
                        <th className="text-right px-3 py-2 font-medium">Budget</th>
                        <th className="text-right px-3 py-2 font-medium">Actual</th>
                        <th className="px-2 py-2 w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {items.map(item => (
                        <tr key={item.id}>
                          <td className="px-3 py-2">{item.description}</td>
                          <td className="px-3 py-2 text-muted-foreground">{item.category}</td>
                          <td className="px-3 py-2 text-muted-foreground">{item.supplier || '—'}</td>
                          <td className="px-3 py-2 text-right">{fmt(Number(item.budget_gbp))}</td>
                          <td className={`px-3 py-2 text-right ${Number(item.actual_gbp) > Number(item.budget_gbp) ? 'text-destructive' : ''}`}>
                            {fmt(Number(item.actual_gbp))}
                          </td>
                          <td className="px-2 py-2">
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteLineItem.mutate(item.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-muted/50 font-medium">
                        <td className="px-3 py-2" colSpan={3}>Total</td>
                        <td className="px-3 py-2 text-right">{fmt(lineBudget)}</td>
                        <td className={`px-3 py-2 text-right ${isOver ? 'text-destructive' : ''}`}>{fmt(totalSpent)}</td>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Charts */}
          {items.length > 0 && (
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle className="text-base">Budget vs Actual</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={barData} layout="vertical" margin={{ left: 80 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tickFormatter={v => fmt(v)} />
                      <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: number) => fmt(v)} />
                      <Bar dataKey="Budget" fill="hsl(var(--muted-foreground))" opacity={0.3} />
                      <Bar dataKey="Actual" fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {categoryData.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-base">Cost by Category</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie data={categoryData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, value }) => `${name}: ${fmt(value)}`}>
                          {categoryData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => fmt(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        {/* Timeline Tab — Gantt */}
        <TabsContent value="timeline">
          <GanttTimeline projectId={id!} />
        </TabsContent>

        {/* Costs Tab — Variance Tracker */}
        <TabsContent value="costs">
          <CostVarianceTracker items={items} totalBudget={totalBudget} />
        </TabsContent>

        {/* Payments Tab — Contractor Schedule */}
        <TabsContent value="payments">
          <ContractorPaymentSchedule projectId={id!} />
        </TabsContent>

        {/* Photos Tab — Photo Journal */}
        <TabsContent value="photos">
          <PhotoJournal projectId={id!} />
        </TabsContent>

        {/* Planning Tab — Planning Tracker */}
        <TabsContent value="planning">
          <PlanningTracker projectId={id!} propertyId={project.property_id} />
        </TabsContent>
      </Tabs>

      {/* Add Line Item Dialog */}
      <Dialog open={showAddItem} onOpenChange={setShowAddItem}>
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
            <Button variant="outline" onClick={() => setShowAddItem(false)}>Cancel</Button>
            <Button onClick={handleAddItem} disabled={!itemDesc || !itemBudget || addLineItem.isPending}>
              {addLineItem.isPending ? 'Adding...' : 'Add Item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
