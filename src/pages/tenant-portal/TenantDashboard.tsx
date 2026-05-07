import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Home, PoundSterling, Wrench, ShieldCheck, CalendarDays,
  AlertCircle, CheckCircle2, Phone, MapPin, Clock, ArrowRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TenantPortalLayoutV2 } from '@/components/tenant-portal/TenantPortalLayoutV2';
import { useTenantPortalSession } from '@/hooks/useTenantPortalSession';
import { supabaseAny } from '@/integrations/supabase/client';
import { LoadingState } from '@/components/common/LoadingState';
import { formatGBP } from '@/lib/calculations';
import { STATUS_CONFIG } from '@/lib/maintenanceTypes';

export default function TenantDashboard() {
  const { tenancyId, tenantId, orgId: _orgId, canViewRent, canSubmitMaintenance } = useTenantPortalSession();

  const { data: tenancy, isLoading: tenancyLoading } = useQuery({
    queryKey: ['tenant-dashboard-tenancy', tenancyId],
    queryFn: async () => {
      if (!tenancyId) return null;
      const { data, error } = await supabaseAny
        .from('tenancy_agreements')
        .select(`
          *,
          property:properties_v2(address_line_1, postcode, city),
          room:rooms_v2(room_name),
          tenant:tenants_v2(first_name, last_name, tenant_type)
        `)
        .eq('id', tenancyId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: tenancy_agreements + embedded relations; pending V2 schema codegen.
      const d = data as any;
      return {
        ...d,
        end_date: d.actual_end_date ?? d.initial_end_date ?? null,
        property: d.property
          ? { ...d.property, address_line: d.property.address_line_1 }
          : null,
      };
    },
    enabled: !!tenancyId,
  });

  const { data: nextRent } = useQuery({
    queryKey: ['tenant-dashboard-next-rent', tenancyId],
    queryFn: async () => {
      if (!tenancyId) return null;
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabaseAny
        .from('rent_schedule')
        .select('*')
        .eq('tenancy_id', tenancyId)
        .gte('due_date', today)
        .order('due_date', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!tenancyId && canViewRent,
  });

  const { data: arrears } = useQuery({
    queryKey: ['tenant-dashboard-arrears', tenancyId],
    queryFn: async () => {
      if (!tenancyId) return null;
      const { data, error } = await supabaseAny
        .from('rent_schedule')
        .select('amount_outstanding')
        .eq('tenancy_id', tenancyId)
        .in('status', ['overdue', 'partial']);
      if (error) throw error;
      const total = (data || []).reduce((sum, r) => sum + (r.amount_outstanding || 0), 0);
      return { total, count: data?.length || 0 };
    },
    enabled: !!tenancyId && canViewRent,
  });

  const { data: openMaintenance } = useQuery({
    queryKey: ['tenant-dashboard-maintenance', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabaseAny
        .from('maintenance_requests')
        .select('id, title, status, priority, created_at')
        .eq('tenant_id', tenantId)
        .not('status', 'in', '("completed","verified","closed","cancelled")')
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: recentPayment } = useQuery({
    queryKey: ['tenant-dashboard-recent-payment', tenancyId],
    queryFn: async () => {
      if (!tenancyId) return null;
      const { data, error } = await supabaseAny
        .from('rent_payments')
        .select('*')
        .eq('tenancy_id', tenancyId)
        .order('payment_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!tenancyId && canViewRent,
  });

  if (tenancyLoading) {
    return (
      <TenantPortalLayoutV2>
        <LoadingState text="Loading your dashboard..." />
      </TenantPortalLayoutV2>
    );
  }

  if (!tenancy) {
    return (
      <TenantPortalLayoutV2>
        <div className="text-center py-12 text-muted-foreground">
          <AlertCircle className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p>Unable to load your tenancy details. Please try refreshing.</p>
        </div>
      </TenantPortalLayoutV2>
    );
  }

  const tenantFullName = `${tenancy.tenant?.first_name || ''} ${tenancy.tenant?.last_name || ''}`.trim();
  const tenantName = tenancy.tenant?.tenant_type === 'company'
    ? ((tenancy.tenant as { company_name?: string }).company_name || tenantFullName)
    : tenantFullName;

  const propertyAddress = [
    tenancy.property?.address_line,
    tenancy.property?.postcode,
  ].filter(Boolean).join(', ');

  return (
    <TenantPortalLayoutV2 propertyName={propertyAddress} tenantName={tenantName}>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Welcome */}
        <div>
          <h1 className="text-2xl font-bold">Welcome back, {tenancy.tenant?.first_name || tenantName}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Here's an overview of your tenancy
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {/* Next rent due */}
          {canViewRent && (
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <PoundSterling className="h-4 w-4" />
                  <span className="text-xs font-medium">Next Rent Due</span>
                </div>
                {nextRent ? (
                  <>
                    <p className="text-lg font-bold">{formatGBP(nextRent.rent_amount)}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(nextRent.due_date), 'dd MMM yyyy')}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No upcoming rent</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Balance / Arrears */}
          {canViewRent && (
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-xs font-medium">Balance</span>
                </div>
                {arrears && arrears.total > 0 ? (
                  <>
                    <p className="text-lg font-bold text-destructive">{formatGBP(arrears.total)}</p>
                    <p className="text-xs text-destructive">{arrears.count} overdue payment(s)</p>
                  </>
                ) : (
                  <>
                    <p className="text-lg font-bold text-primary">{formatGBP(0)}</p>
                    <p className="text-xs text-primary flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Up to date
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Active maintenance */}
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Wrench className="h-4 w-4" />
                <span className="text-xs font-medium">Open Repairs</span>
              </div>
              <p className="text-lg font-bold">{openMaintenance?.length || 0}</p>
              <p className="text-xs text-muted-foreground">active request(s)</p>
            </CardContent>
          </Card>

          {/* Tenancy status */}
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <CalendarDays className="h-4 w-4" />
                <span className="text-xs font-medium">Tenancy</span>
              </div>
              <Badge variant={tenancy.status === 'active' ? 'default' : 'secondary'} className="mt-1">
                {tenancy.status}
              </Badge>
              <p className="text-xs text-muted-foreground mt-1">
                {tenancy.end_date
                  ? `Ends ${format(new Date(tenancy.end_date), 'dd MMM yyyy')}`
                  : 'Rolling tenancy'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Property Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Home className="h-4 w-4" />
              Your Property
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">{tenancy.property?.address_line}</p>
                    {tenancy.room?.room_name && (
                      <p className="text-xs text-muted-foreground">{tenancy.room.room_name}</p>
                    )}
                    <p className="text-xs text-muted-foreground">{tenancy.property?.postcode}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Monthly rent:</span>
                  <span className="font-medium">{formatGBP(tenancy.rent_amount_pcm)}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Start:</span>
                  <span>{tenancy.start_date ? format(new Date(tenancy.start_date), 'dd MMM yyyy') : '—'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">End:</span>
                  <span>{tenancy.end_date ? format(new Date(tenancy.end_date), 'dd MMM yyyy') : 'Rolling'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Emergency:</span>
                  <span className="font-medium text-destructive">999</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Recent maintenance */}
          {canSubmitMaintenance && openMaintenance && openMaintenance.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Wrench className="h-4 w-4" />
                    Open Repairs
                  </CardTitle>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/tenant-portal/maintenance">
                      View all <ArrowRight className="ml-1 h-3 w-3" />
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {openMaintenance.slice(0, 3).map((req) => (
                  <div key={req.id} className="flex items-center justify-between py-1.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{req.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(req.created_at), 'dd MMM yyyy')}
                      </p>
                    </div>
                    <Badge variant="outline" className={STATUS_CONFIG[req.status as keyof typeof STATUS_CONFIG]?.color || ''}>
                      {STATUS_CONFIG[req.status as keyof typeof STATUS_CONFIG]?.label || req.status}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Last payment */}
          {canViewRent && recentPayment && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <PoundSterling className="h-4 w-4" />
                    Last Payment
                  </CardTitle>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/tenant-portal/payments">
                      View all <ArrowRight className="ml-1 h-3 w-3" />
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-bold">{formatGBP(recentPayment.amount)}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(recentPayment.payment_date), 'dd MMM yyyy')}
                    </p>
                  </div>
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                    Paid
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 grid-cols-2 sm:grid-cols-4">
              {canViewRent && (
                <Button variant="outline" className="h-auto py-3 flex flex-col gap-1" asChild>
                  <Link to="/tenant-portal/payments">
                    <PoundSterling className="h-5 w-5" />
                    <span className="text-xs">View Payments</span>
                  </Link>
                </Button>
              )}
              {canSubmitMaintenance && (
                <Button variant="outline" className="h-auto py-3 flex flex-col gap-1" asChild>
                  <Link to="/tenant-portal/maintenance">
                    <Wrench className="h-5 w-5" />
                    <span className="text-xs">Report Repair</span>
                  </Link>
                </Button>
              )}
              <Button variant="outline" className="h-auto py-3 flex flex-col gap-1" asChild>
                <Link to="/tenant-portal/certificates">
                  <ShieldCheck className="h-5 w-5" />
                  <span className="text-xs">Certificates</span>
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </TenantPortalLayoutV2>
  );
}
