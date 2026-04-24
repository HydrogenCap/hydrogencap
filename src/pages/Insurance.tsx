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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/common';
import {
  useInsurancePolicies,
  useInsuranceStats,
  useExpiringPolicies,
  useCreatePolicy,
  useUpdatePolicy,
  useCoverageGaps,
  TRACKER_POLICY_TYPES,
  POLICY_STATUSES,
  type InsuranceTrackerPolicy,
} from '@/hooks/useInsuranceTracker';
import { InsurancePolicyForm, CoverageMatrix, ClaimsTracker } from '@/components/insurance';
import { formatGBP } from '@/lib/calculations';
import { SEVERITY, TEXT } from '@/lib/design-tokens';
import { cn } from '@/lib/utils';

function getExpiryBadge(endDate: string | null, status: string | null) {
  if (status === 'cancelled') {
    return <Badge className={cn('text-xs', SEVERITY.neutral.badge)}>Cancelled</Badge>;
  }
  if (status === 'expired' || (endDate && new Date(endDate) < new Date())) {
    return <Badge className="text-xs bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">Expired</Badge>;
  }
  if (!endDate) {
    return <Badge variant="outline" className="text-xs">No expiry</Badge>;
  }

  const now = new Date();
  const end = new Date(endDate);
  const daysUntil = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntil <= 30) {
    return <Badge className={cn('text-xs', SEVERITY.critical.badge)}>{daysUntil}d left</Badge>;
  }
  if (daysUntil <= 90) {
    return <Badge className={cn('text-xs', SEVERITY.warning.badge)}>{daysUntil}d left</Badge>;
  }
  return <Badge className={cn('text-xs', SEVERITY.success.badge)}>{daysUntil}d left</Badge>;
}

function KPICards() {
  const { data: stats, isLoading } = useInsuranceStats();

  const cards = [
    {
      title: 'Total Annual Premiums',
      value: isLoading ? '...' : formatGBP(stats?.totalAnnualPremiums ?? 0),
      icon: PoundSterling,
      color: 'text-primary',
    },
    {
      title: 'Active Policies',
      value: isLoading ? '...' : (stats?.activePoliciesCount ?? 0).toString(),
      icon: Shield,
      color: SEVERITY.success.text,
    },
    {
      title: 'Expiring in 30 Days',
      value: isLoading ? '...' : (stats?.expiringIn30Count ?? 0).toString(),
      icon: AlertTriangle,
      color: stats?.expiringIn30Count ? SEVERITY.critical.text : SEVERITY.warning.text,
    },
    {
      title: 'Open Claims',
      value: isLoading ? '...' : (stats?.openClaimsCount ?? 0).toString(),
      icon: FileText,
      color: SEVERITY.info.text,
    },
  ];

  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
      {cards.map(card => (
        <Card key={card.title}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className={TEXT.label}>{card.title}</p>
                <p className="text-2xl font-bold mt-1">{card.value}</p>
              </div>
              <card.icon className={cn('h-8 w-8 opacity-80', card.color)} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function CoverageGapAlert() {
  const { data: gaps } = useCoverageGaps();
  const propertiesWithGaps = gaps?.filter(g => g.hasGaps) || [];

  if (propertiesWithGaps.length === 0) return null;

  return (
    <Card className={cn('border', SEVERITY.critical.border, SEVERITY.critical.bg)}>
      <CardContent className="py-3 px-4">
        <div className="flex items-start gap-2">
          <AlertTriangle className={cn('h-4 w-4 mt-0.5', SEVERITY.critical.text)} />
          <div>
            <p className={cn('text-sm font-medium', SEVERITY.critical.text)}>
              Coverage gaps detected
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {propertiesWithGaps.length} {propertiesWithGaps.length === 1 ? 'property' : 'properties'} missing required insurance:{' '}
              {propertiesWithGaps.slice(0, 3).map(g => g.address_line).join(', ')}
              {propertiesWithGaps.length > 3 && ` and ${propertiesWithGaps.length - 3} more`}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
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

            const severity = daysLeft == null ? 'neutral'
              : daysLeft <= 30 ? 'critical'
              : daysLeft <= 90 ? 'warning'
              : 'success';

            return (
              <div
                key={policy.id}
                className={cn(
                  'flex items-center justify-between rounded-lg p-3',
                  SEVERITY[severity as keyof typeof SEVERITY].bg
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn('w-2 h-2 rounded-full', SEVERITY[severity as keyof typeof SEVERITY].dot)} />
                  <div>
                    <div className="font-medium text-sm">{policy.property?.address_line || 'Unknown'}</div>
                    <div className="text-xs text-muted-foreground">
                      {policy.insurer_name || 'Unknown insurer'} — {TRACKER_POLICY_TYPES.find(t => t.value === policy.policy_type)?.label || policy.policy_type}
                    </div>
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
      createPolicy.mutate(data as unknown as Parameters<typeof createPolicy.mutate>[0], {
        onSuccess: () => {
          setShowPolicyForm(false);
        },
      });
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className={TEXT.sectionHeading}>Policies</h2>
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Property</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Insurer</TableHead>
                <TableHead>Policy No.</TableHead>
                <TableHead className="text-right">Premium</TableHead>
                <TableHead className="text-right">Cover</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPolicies.map(policy => (
                <TableRow
                  key={policy.id}
                  className="cursor-pointer"
                  onClick={() => { setEditingPolicy(policy); setShowPolicyForm(true); }}
                >
                  <TableCell>
                    <div className="font-medium">{policy.property?.address_line || 'Unknown'}</div>
                    <div className="text-xs text-muted-foreground">{policy.property?.postcode}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {TRACKER_POLICY_TYPES.find(t => t.value === policy.policy_type)?.label || policy.policy_type || '—'}
                    </Badge>
                  </TableCell>
                  <TableCell>{policy.insurer_name || '—'}</TableCell>
                  <TableCell className="font-mono text-xs">{policy.policy_number || '—'}</TableCell>
                  <TableCell className="text-right">{formatGBP(policy.premium_annual)}</TableCell>
                  <TableCell className="text-right">{formatGBP(policy.cover_amount)}</TableCell>
                  <TableCell>
                    {policy.end_date
                      ? new Date(policy.end_date).toLocaleDateString('en-GB')
                      : '—'}
                  </TableCell>
                  <TableCell>
                    {getExpiryBadge(policy.end_date, policy.status)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
      <div className="space-y-6 p-6">
        <div>
          <h1 className={TEXT.pageTitle}>Insurance</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage your property insurance portfolio, track coverage gaps, and monitor claims
          </p>
        </div>

        <KPICards />

        <CoverageGapAlert />

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
