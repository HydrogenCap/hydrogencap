import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useIsAdmin } from '@/hooks/usePlatformAdmin';
import { useAdminDashboard, useAdminUsers, useGrantTrial, useChangePlan } from '@/hooks/useAdminStats';
import { useActivationFunnel, type ActivationStage } from '@/hooks/useActivationFunnel';
import { PoundSterling, Users, TrendingUp, TrendingDown, Ellipsis, Search, ExternalLink } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { format } from 'date-fns';

const TIER_COLORS: Record<string, string> = {
  free: 'hsl(var(--muted-foreground))',
  solo: 'hsl(var(--primary))',
  portfolio: 'hsl(210 80% 55%)',
  pro: 'hsl(280 70% 55%)',
};

const TIER_BADGE_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  free: 'outline',
  solo: 'secondary',
  portfolio: 'default',
  pro: 'default',
};

interface RecentSignup {
  id: string;
  email: string;
  created_at: string;
  tier: string;
}

interface AdminUser {
  id: string;
  full_name: string | null;
  email: string;
  org_name: string | null;
  tier: string;
  status: string;
  created_at: string | null;
  last_sign_in_at: string | null;
  stripe_customer_id: string | null;
}

function formatPence(pence: number) {
  return `£${(pence / 100).toLocaleString('en-GB', { minimumFractionDigits: 0 })}`;
}

export default function AdminDashboard() {
  const isAdmin = useIsAdmin();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);

  const { data: dashboard, isLoading: dashLoading } = useAdminDashboard();
  const { data: usersData, isLoading: usersLoading } = useAdminUsers({
    search: search || undefined,
    tierFilter,
    statusFilter,
    page,
    pageSize: 50,
  });
  const grantTrial = useGrantTrial();
  const changePlan = useChangePlan();
  const { data: funnel, isLoading: funnelLoading } = useActivationFunnel();

  if (isAdmin === false) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleGrantTrial = (userId: string) => {
    grantTrial.mutate({ userId, days: 14 }, {
      onSuccess: () => toast({ title: '14-day trial granted' }),
      onError: (err) => toast({ title: 'Failed', description: err.message, variant: 'destructive' }),
    });
  };

  const handleChangePlan = (userId: string, newTier: string) => {
    changePlan.mutate({ userId, newTier }, {
      onSuccess: () => toast({ title: `Plan changed to ${newTier}` }),
      onError: (err) => toast({ title: 'Failed', description: err.message, variant: 'destructive' }),
    });
  };

  const tierData = dashboard?.tierBreakdown
    ? Object.entries(dashboard.tierBreakdown as Record<string, { count: number; mrr: number }>)
        .filter(([, v]) => v.count > 0)
        .map(([tier, v]) => ({ name: tier, value: v.count, mrr: v.mrr }))
    : [];

  return (
    <AppLayout>
      <div className="space-y-6 p-6">
        <h1 className="text-2xl font-bold">Platform Admin</h1>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            title="MRR"
            value={dashLoading ? undefined : formatPence(dashboard?.mrr || 0)}
            icon={<PoundSterling className="h-4 w-4 text-muted-foreground" />}
          />
          <KPICard
            title="Active Subscribers"
            value={dashLoading ? undefined : String(dashboard?.activeCount || 0)}
            icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
          />
          <KPICard
            title="Total Users"
            value={dashLoading ? undefined : String(dashboard?.totalUsers || 0)}
            icon={<Users className="h-4 w-4 text-muted-foreground" />}
          />
          <KPICard
            title="Churn This Month"
            value={dashLoading ? undefined : String(dashboard?.churnCount || 0)}
            icon={<TrendingDown className="h-4 w-4 text-muted-foreground" />}
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Subscription Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Subscription Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              {dashLoading ? (
                <Skeleton className="h-48" />
              ) : tierData.length > 0 ? (
                <div className="flex items-center gap-6">
                  <ResponsiveContainer width={180} height={180}>
                    <PieChart>
                      <Pie data={tierData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2}>
                        {tierData.map((entry) => (
                          <Cell key={entry.name} fill={TIER_COLORS[entry.name] || '#888'} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value, name) => [value, String(name).charAt(0).toUpperCase() + String(name).slice(1)]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2">
                    {tierData.map((t) => (
                      <div key={t.name} className="flex items-center gap-2 text-sm">
                        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: TIER_COLORS[t.name] }} />
                        <span className="capitalize font-medium">{t.name}</span>
                        <span className="text-muted-foreground">{t.value} users</span>
                        {t.mrr > 0 && <span className="text-muted-foreground">({formatPence(t.mrr)}/mo)</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No subscription data yet.</p>
              )}
            </CardContent>
          </Card>

          {/* Recent Sign-ups */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Sign-ups</CardTitle>
            </CardHeader>
            <CardContent>
              {dashLoading ? (
                <Skeleton className="h-48" />
              ) : (
                <div className="space-y-2 max-h-[280px] overflow-y-auto">
                  {((dashboard?.recentSignups || []) as RecentSignup[]).slice(0, 10).map((u) => (
                    <div key={u.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0">
                      <div>
                        <span className="font-medium">{u.email}</span>
                        <span className="text-muted-foreground ml-2">{format(new Date(u.created_at), 'dd MMM yyyy')}</span>
                      </div>
                      <Badge variant={TIER_BADGE_VARIANT[u.tier] || 'outline'} className="capitalize text-xs">
                        {u.tier}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Activation Funnel (§4.1) */}
        <ActivationFunnelSection data={funnel} loading={funnelLoading} />

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">All Users</CardTitle>
            <div className="flex flex-wrap items-center gap-3 mt-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by email, name, or org..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="pl-9"
                />
              </div>
              <Select value={tierFilter} onValueChange={(v) => { setTierFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Plans</SelectItem>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="solo">Solo</SelectItem>
                  <SelectItem value="portfolio">Portfolio</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="trialing">Trialing</SelectItem>
                  <SelectItem value="past_due">Past Due</SelectItem>
                  <SelectItem value="canceled">Canceled</SelectItem>
                  <SelectItem value="free">Free</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {usersLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Org</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Signed Up</TableHead>
                      <TableHead>Last Active</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {((usersData?.users || []) as AdminUser[]).map((u) => (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium text-sm">{u.full_name || '—'}</div>
                            <div className="text-xs text-muted-foreground">{u.email}</div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{u.org_name || '—'}</TableCell>
                        <TableCell>
                          <Badge variant={TIER_BADGE_VARIANT[u.tier] || 'outline'} className="capitalize text-xs">
                            {u.tier}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={u.status} />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {u.created_at ? format(new Date(u.created_at), 'dd MMM yy') : '—'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {u.last_sign_in_at ? format(new Date(u.last_sign_in_at), 'dd MMM yy') : 'Never'}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <Ellipsis className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {u.stripe_customer_id && (
                                <DropdownMenuItem onClick={() => window.open(`https://dashboard.stripe.com/customers/${u.stripe_customer_id}`, '_blank')}>
                                  <ExternalLink className="h-3.5 w-3.5 mr-2" /> View in Stripe
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => handleGrantTrial(u.id)}>
                                Grant 14-day Trial
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleChangePlan(u.id, 'solo')}>
                                Set to Solo
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleChangePlan(u.id, 'portfolio')}>
                                Set to Portfolio
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleChangePlan(u.id, 'pro')}>
                                Set to Pro
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {usersData && usersData.total > 50 && (
                  <div className="flex justify-between items-center mt-4">
                    <span className="text-sm text-muted-foreground">
                      Showing {((page - 1) * 50) + 1}–{Math.min(page * 50, usersData.total)} of {usersData.total}
                    </span>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                        Previous
                      </Button>
                      <Button variant="outline" size="sm" disabled={page * 50 >= usersData.total} onClick={() => setPage(page + 1)}>
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

function KPICard({ title, value, icon }: { title: string; value?: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            {value !== undefined ? (
              <p className="text-2xl font-bold">{value}</p>
            ) : (
              <Skeleton className="h-8 w-20 mt-1" />
            )}
          </div>
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
    active: 'default',
    trialing: 'secondary',
    past_due: 'destructive',
    canceled: 'outline',
    free: 'outline',
  };

  return (
    <Badge variant={variants[status] || 'outline'} className="capitalize text-xs">
      {status === 'past_due' ? 'Past Due' : status}
    </Badge>
  );
}
