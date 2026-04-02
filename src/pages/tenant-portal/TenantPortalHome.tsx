import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Home, PoundSterling, Wrench, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TenantPortalLayout } from '@/components/tenant-portal/TenantPortalLayout';
import { useTenantPortalSession } from '@/hooks/useTenantPortalSession';
import { supabase } from '@/integrations/supabase/client';
import { LoadingState } from '@/components/common/LoadingState';
import { formatGBP } from '@/lib/calculations';

export default function TenantPortalHome() {
  const { tenancyId, tenantId, canViewRent } = useTenantPortalSession();

  // Fetch tenancy details
  const { data: tenancy, isLoading: tenancyLoading, isError: tenancyError } = useQuery({
    queryKey: ['tenant-portal-tenancy', tenancyId],
    queryFn: async () => {
      if (!tenancyId) return null;
      const { data, error } = await (supabase as any)
        .from('tenancies')
        .select(`
          *,
          property:properties(address_line, postcode),
          room:rooms(room_name),
          tenant:tenants(first_name, last_name, company_name, tenant_type)
        `)
        .eq('id', tenancyId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!tenancyId,
  });

  // Fetch recent rent schedule
  const { data: recentRent } = useQuery({
    queryKey: ['tenant-portal-recent-rent', tenancyId],
    queryFn: async () => {
      if (!tenancyId) return null;
      const { data, error } = await (supabase as any)
        .from('rent_schedule')
        .select('*')
        .eq('tenancy_id', tenancyId)
        .order('due_date', { ascending: false })
        .limit(3);
      if (error) throw error;
      return data;
    },
    enabled: !!tenancyId && canViewRent,
  });

  // Fetch open maintenance requests
  const { data: openRequests } = useQuery({
    queryKey: ['tenant-portal-open-maintenance', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const { data, error } = await (supabase as any)
        .from('maintenance_requests')
        .select('*')
        .eq('tenant_id', tenantId)
        .not('status', 'eq', 'completed')
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  if (tenancyLoading) {
    return (
      <TenantPortalLayout>
        <LoadingState text="Loading your tenancy..." />
      </TenantPortalLayout>
    );
  }

  if (tenancyError || !tenancy) {
    return (
      <TenantPortalLayout>
        <div className="text-center py-12 text-muted-foreground">
          <AlertCircle className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p>Unable to load your tenancy. Please try refreshing.</p>
        </div>
      </TenantPortalLayout>
    );
  }

  const tenantName = tenancy.tenant?.tenant_type === 'company'
    ? tenancy.tenant.company_name
    : `${tenancy.tenant?.first_name} ${tenancy.tenant?.last_name}`;

  const nextDue = recentRent?.find(r => r.status === 'upcoming' || r.status === 'due');
  const overdue = recentRent?.filter(r => r.status === 'overdue') || [];

  return (
    <TenantPortalLayout>
      <div className="space-y-6">
        {/* Welcome header */}
        <div>
          <h1 className="text-2xl font-bold">Welcome, {tenantName}</h1>
          <p className="text-muted-foreground">
            {tenancy.room?.room_name && `${tenancy.room.room_name} - `}
            {tenancy.property?.address_line}, {tenancy.property?.postcode}
          </p>
        </div>

        {/* Summary cards */}
        <div className="grid gap-4 md:grid-cols-3">
          {/* Tenancy info */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Home className="h-4 w-4" />
                Your Tenancy
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Monthly rent</span>
                  <span className="font-medium">{formatGBP(tenancy.rent_amount_pcm)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Start date</span>
                  <span>{tenancy.start_date ? format(new Date(tenancy.start_date), 'dd MMM yyyy') : '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">End date</span>
                  <span>{tenancy.end_date ? format(new Date(tenancy.end_date), 'dd MMM yyyy') : 'Rolling'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant={tenancy.status === 'active' ? 'default' : 'secondary'}>
                    {tenancy.status}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Rent status */}
          {canViewRent && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <PoundSterling className="h-4 w-4" />
                  Rent Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                {overdue.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-destructive">
                      <AlertCircle className="h-4 w-4" />
                      <span className="text-sm font-medium">{overdue.length} overdue payment(s)</span>
                    </div>
                    {overdue.map(r => (
                      <div key={r.id} className="text-xs text-muted-foreground">
                        {formatGBP(r.amount_outstanding)} due {format(new Date(r.due_date), 'dd MMM')}
                      </div>
                    ))}
                  </div>
                ) : nextDue ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-primary">
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="text-sm font-medium">Up to date</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Next: {formatGBP(nextDue.rent_amount)} on {format(new Date(nextDue.due_date), 'dd MMM yyyy')}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No rent data available</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Maintenance */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Wrench className="h-4 w-4" />
                Maintenance
              </CardTitle>
            </CardHeader>
            <CardContent>
              {openRequests && openRequests.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">{openRequests.length} open request(s)</p>
                  {openRequests.slice(0, 2).map(req => (
                    <div key={req.id} className="text-xs text-muted-foreground">
                      {req.title} - <Badge variant="outline" className="text-xs">{req.status}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No open requests</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </TenantPortalLayout>
  );
}
