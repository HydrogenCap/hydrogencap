import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { LoadingState } from '@/components/common';
import { MAINTENANCE_CATEGORY_NAMES, type MaintenanceSpendByCategory, type ContractorPerformanceRow, type RecurringIssueRow } from '@/lib/maintenanceTypes';
import { AlertTriangle, TrendingUp, Star, Repeat } from 'lucide-react';

const CHART_COLORS = [
  'hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))',
  'hsl(var(--chart-4))', 'hsl(var(--chart-5))', 'hsl(var(--accent))',
];

function useMaintenanceAnalytics() {
  const spendByCategory = useQuery({
    queryKey: ['maintenance_spend_by_category'],
    queryFn: async () => {
      const { data, error } = await supabase.from('maintenance_spend_by_category' as never).select('*');
      if (error) throw error;
      return (data || []) as unknown as MaintenanceSpendByCategory[];
    },
  });

  const contractorPerformance = useQuery({
    queryKey: ['contractor_maintenance_performance'],
    queryFn: async () => {
      const { data, error } = await supabase.from('contractor_maintenance_performance' as never).select('*');
      if (error) throw error;
      return (data || []) as unknown as ContractorPerformanceRow[];
    },
  });

  const recurringIssues = useQuery({
    queryKey: ['recurring_issue_detection'],
    queryFn: async () => {
      const { data, error } = await supabase.from('recurring_issue_detection' as never).select('*');
      if (error) throw error;
      return (data || []) as unknown as RecurringIssueRow[];
    },
  });

  return { spendByCategory, contractorPerformance, recurringIssues };
}

export function MaintenanceAnalytics() {
  const { spendByCategory, contractorPerformance, recurringIssues } = useMaintenanceAnalytics();

  if (spendByCategory.isLoading) return <LoadingState text="Loading analytics..." />;

  const categoryData = (spendByCategory.data || []).map(c => ({
    name: MAINTENANCE_CATEGORY_NAMES[c.category] || c.category,
    spend: Number(c.total_spend) || 0,
    jobs: c.job_count,
    avgCost: Number(c.avg_cost) || 0,
    avgDays: Number(c.avg_resolution_days) || 0,
  })).filter(c => c.jobs > 0);

  const totalSpend = categoryData.reduce((s, c) => s + c.spend, 0);
  const totalJobs = categoryData.reduce((s, c) => s + c.jobs, 0);

  return (
    <div className="space-y-6">
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Jobs</p>
            <p className="text-2xl font-bold">{totalJobs}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Spend</p>
            <p className="text-2xl font-bold">£{totalSpend.toLocaleString('en-GB', { minimumFractionDigits: 0 })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Avg Cost/Job</p>
            <p className="text-2xl font-bold">£{totalJobs > 0 ? Math.round(totalSpend / totalJobs).toLocaleString() : 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Categories</p>
            <p className="text-2xl font-bold">{categoryData.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Spend by Category Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Spend by Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            {categoryData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No spend data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={categoryData} layout="vertical" margin={{ left: 80 }}>
                  <XAxis type="number" tickFormatter={v => `£${v}`} />
                  <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => [`£${v.toFixed(0)}`, 'Spend']} />
                  <Bar dataKey="spend" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Category Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Jobs by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {categoryData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No job data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={categoryData} dataKey="jobs" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {categoryData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Contractor Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Star className="h-4 w-4" /> Contractor Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!contractorPerformance.data || contractorPerformance.data.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No contractor data yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground text-left">
                    <th className="pb-2 font-medium">Contractor</th>
                    <th className="pb-2 font-medium">Rating</th>
                    <th className="pb-2 font-medium text-right">Jobs</th>
                    <th className="pb-2 font-medium text-right">Total Paid</th>
                    <th className="pb-2 font-medium text-right">Avg Cost</th>
                    <th className="pb-2 font-medium text-right">Avg Days</th>
                    <th className="pb-2 font-medium text-right">Disputed</th>
                  </tr>
                </thead>
                <tbody>
                  {contractorPerformance.data.map(c => (
                    <tr key={c.contractor_id} className="border-b last:border-0">
                      <td className="py-2 font-medium">{c.company_name}</td>
                      <td className="py-2">
                        {c.rating ? (
                          <span className="flex items-center gap-1">
                            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                            {c.rating}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="py-2 text-right">{c.completed_jobs}/{c.total_jobs}</td>
                      <td className="py-2 text-right">£{Number(c.total_paid).toLocaleString()}</td>
                      <td className="py-2 text-right">£{Number(c.avg_job_cost).toFixed(0)}</td>
                      <td className="py-2 text-right">{Number(c.avg_report_to_completion_days).toFixed(0)}d</td>
                      <td className="py-2 text-right">
                        {c.disputed_jobs > 0 ? (
                          <Badge variant="destructive" className="text-[10px]">{c.disputed_jobs}</Badge>
                        ) : '0'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recurring Issues */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Repeat className="h-4 w-4" /> Recurring Issues (3+ in 12 months)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!recurringIssues.data || recurringIssues.data.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No recurring patterns detected — great news!</p>
          ) : (
            <div className="space-y-3">
              {recurringIssues.data.map((issue, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg border bg-destructive/5 border-destructive/20">
                  <div>
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                      <span className="font-medium">{MAINTENANCE_CATEGORY_NAMES[issue.category] || issue.category}</span>
                      <Badge variant="destructive" className="text-[10px]">{issue.request_count}x</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{issue.property_address}</p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-medium">£{Number(issue.total_spend).toLocaleString()}</p>
                    <p className="text-muted-foreground text-xs">total spend</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
