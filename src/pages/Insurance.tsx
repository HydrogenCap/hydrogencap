import { useState, useDeferredValue } from 'react';
import {
  Plus,
  Search,
  Shield,
  PoundSterling,
  AlertTriangle,
  FileText,
  Filter,
  Calendar,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/common';
import {
  useInsurancePolicies,
  useInsuranceStats,
  useExpiringPolicies,
  useCreatePolicy,
  useUpdatePolicy,
  TRACKER_POLICY_TYPES,
  POLICY_STATUSES,
  type InsuranceTrackerPolicy,
} from '@/hooks/useInsuranceTracker';
import { InsurancePolicyForm, CoverageMatrix, ClaimsTracker } from '@/components/insurance';

function getExpiryBadge(endDate: string | null, status: string | null) {
  if (status === 'cancelled') {
    return <Badge variant="outline" className="bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400">Cancelled</Badge>;
  }
  if (status === 'expired' || (endDate && new Date(endDate) < new Date())) {
    return <Badge variant="destructive" className="bg-black text-white">Expired</Badge>;
  }
  if (!endDate) {
    return <Badge variant="outline">No expiry</Badge>;
  }

  const now = new Date();
  const end = new Date(endDate);
  const daysUntil = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntil <= 30) {
    return <Badge variant="destructive">{daysUntil}d left</Badge>;
  }
  if (daysUntil <= 90) {
    return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">{daysUntil}d left</Badge>;
  }
  return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">{daysUntil}d left</Badge>;
}

function formatCurrency(amount: number | null) {
  if (amount == null) return '—';
  return `\u00a3${amount.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`;
}

function KPICards() {
  const { data: stats, isLoading } = useInsuranceStats();

  const cards = [
    {
      title: 'Total Annual Premiums',
      value: isLoading ? '...' : formatCurrency(stats?.totalAnnualPremiums ?? 0),
      icon: PoundSterling,
      color: 'text-primary',
    },
    {
      title: 'Active Policies',
      value: isLoading ? '...' : (stats?.activePoliciesCount ?? 0).toString(),
      icon: Shield,
      color: 'text-emerald-600',
    },
    {
      title: 'Expiring in 30 Days',
      value: isLoading ? '...' : (stats?.expiringIn30Count ?? 0).toString(),
      icon: AlertTriangle,
      color: stats?.expiringIn30Count ? 'text-destructive' : 'text-amber-600',
    },
    {
      title: 'Open Claims',
      value: isLoading ? '...' : (stats?.openClaimsCount ?? 0).toString(),
      icon: FileText,
      color: 'text-blue-600',
    },
  ];

  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
      {cards.map(card => (
        <Card key={card.title}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{card.title}</p>
                <p className="text-2xl font-bold mt-1">{card.value}</p>
              </div>
              <card.icon className={`h-8 w-8 ${card.color} opacity-80`} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function RenewalCalendar() {
  const { data: expiring, isLoading } = useExpiringPolicies(90);

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" />Renewal Calendar</CardTitle></CardHeader>
        <CardContent><div className="h-24 animate-pulse bg-muted rounded" /></CardContent>
      </Card>
    );
  }

  if (!expiring?.length) {
    return (
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" />Renewal Calendar</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No policies expiring in the next 90 days.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Renewal Calendar
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {expiring.map(policy => {
            const daysLeft = policy.end_date
              ? Math.ceil((new Date(policy.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
              : null;
            return (
              <div
                key={policy.id}
                className="flex items-center justify-between border rounded-lg p-3"
              >
                <div>
                  <div className="font-medium text-sm">{policy.property?.address_line || 'Unknown'}</div>
                  <div className="text-xs text-muted-foreground">
                    {policy.insurer_name || 'Unknown insurer'} — {TRACKER_POLICY_TYPES.find(t => t.value === policy.policy_type)?.label || policy.policy_type}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {policy.auto_renew && (
                    <Badge variant="outline" className="text-xs">Auto-renew</Badge>
                  )}
                  {getExpiryBadge(policy.end_date, policy.status)}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function PoliciesTable() {
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearch = useDeferredValue(searchTerm);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: policies, isLoading } = useInsurancePolicies({
    policyType: typeFilter !== 'all' ? typeFilter : undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
  });

  const [showPolicyForm, setShowPolicyForm] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<InsuranceTrackerPolicy | null>(null);
  const createPolicy = useCreatePolicy();
  const updatePolicy = useUpdatePolicy();

  const filteredPolicies = policies?.filter(p => {
    if (!deferredSearch) return true;
    const search = deferredSearch.toLowerCase();
    return (
      p.property?.address_line?.toLowerCase().includes(search) ||
      p.insurer_name?.toLowerCase().includes(search) ||
      p.policy_number?.toLowerCase().includes(search)
    );
  });

  const handleSubmit = (data: Record<string, unknown>) => {
    if (editingPolicy) {
      updatePolicy.mutate(
        { id: editingPolicy.id, ...data },
        {
          onSuccess: () => {
            setShowPolicyForm(false);
            setEditingPolicy(null);
          },
        }
      );
    } else {
      createPolicy.mutate(data as any, {
        onSuccess: () => {
          setShowPolicyForm(false);
        },
      });
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Policies</h2>
        <Button onClick={() => { setEditingPolicy(null); setShowPolicyForm(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Add Policy
        </Button>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search policies..."
            aria-label="Search policies"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-48">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Policy type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {TRACKER_POLICY_TYPES.map(t => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {POLICY_STATUSES.map(s => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-16 animate-pulse bg-muted rounded" />
          ))}
        </div>
      ) : !filteredPolicies?.length ? (
        <EmptyState
          icon={Shield}
          title="No policies found"
          description="Add your first insurance policy to get started."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 pr-4 font-medium">Property</th>
                <th className="text-left py-3 px-2 font-medium">Type</th>
                <th className="text-left py-3 px-2 font-medium">Insurer</th>
                <th className="text-left py-3 px-2 font-medium">Policy No.</th>
                <th className="text-right py-3 px-2 font-medium">Premium</th>
                <th className="text-right py-3 px-2 font-medium">Cover</th>
                <th className="text-left py-3 px-2 font-medium">Expiry</th>
                <th className="text-left py-3 pl-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredPolicies.map(policy => (
                <tr
                  key={policy.id}
                  className="border-b last:border-0 hover:bg-accent/50 cursor-pointer transition-colors"
                  onClick={() => { setEditingPolicy(policy); setShowPolicyForm(true); }}
                >
                  <td className="py-3 pr-4">
                    <div className="font-medium">{policy.property?.address_line || 'Unknown'}</div>
                    <div className="text-xs text-muted-foreground">{policy.property?.postcode}</div>
                  </td>
                  <td className="py-3 px-2">
                    {TRACKER_POLICY_TYPES.find(t => t.value === policy.policy_type)?.label || policy.policy_type || '—'}
                  </td>
                  <td className="py-3 px-2">{policy.insurer_name || '—'}</td>
                  <td className="py-3 px-2 font-mono text-xs">{policy.policy_number || '—'}</td>
                  <td className="py-3 px-2 text-right">{formatCurrency(policy.premium_annual)}</td>
                  <td className="py-3 px-2 text-right">{formatCurrency(policy.cover_amount)}</td>
                  <td className="py-3 px-2">
                    {policy.end_date
                      ? new Date(policy.end_date).toLocaleDateString('en-GB')
                      : '—'}
                  </td>
                  <td className="py-3 pl-2">
                    {getExpiryBadge(policy.end_date, policy.status)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <InsurancePolicyForm
        open={showPolicyForm}
        onOpenChange={(open) => {
          setShowPolicyForm(open);
          if (!open) setEditingPolicy(null);
        }}
        policy={editingPolicy}
        onSubmit={handleSubmit}
        isSubmitting={createPolicy.isPending || updatePolicy.isPending}
      />
    </>
  );
}

export default function Insurance() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Insurance</h1>
          <p className="text-muted-foreground">
            Manage your property insurance portfolio, track coverage gaps, and monitor claims
          </p>
        </div>

        <KPICards />

        <Tabs defaultValue="policies">
          <TabsList>
            <TabsTrigger value="policies">Policies</TabsTrigger>
            <TabsTrigger value="coverage">Coverage Matrix</TabsTrigger>
            <TabsTrigger value="claims">Claims</TabsTrigger>
            <TabsTrigger value="renewals">Renewals</TabsTrigger>
          </TabsList>

          <TabsContent value="policies" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                <PoliciesTable />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="coverage" className="mt-4">
            <CoverageMatrix />
          </TabsContent>

          <TabsContent value="claims" className="mt-4">
            <ClaimsTracker />
          </TabsContent>

          <TabsContent value="renewals" className="mt-4">
            <RenewalCalendar />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
