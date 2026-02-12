 import { useState } from 'react';
 import { Link } from 'react-router-dom';
 import { Users, Plus, Search, Filter, Mail, Phone, Home, UserCheck, UserX, Clock, Building2 } from 'lucide-react';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
 import { Badge } from '@/components/ui/badge';
 import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
 import { AppLayout } from '@/components/layout/AppLayout';
 import { useTenantsWithProperty, TenantStatus, TenantWithProperty } from '@/hooks/useTenants';
 import { LoadingState, EmptyState } from '@/components/common';
 import { AddTenantDialog } from '@/components/tenants/AddTenantDialog';
 
 const statusConfig: Record<TenantStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ElementType }> = {
   prospect: { label: 'Prospect', variant: 'outline', icon: Clock },
   active: { label: 'Active', variant: 'default', icon: UserCheck },
   past: { label: 'Past', variant: 'secondary', icon: UserX },
   blacklisted: { label: 'Blacklisted', variant: 'destructive', icon: UserX },
 };
 
function TenantCard({ tenant }: { tenant: TenantWithProperty }) {
  const status = statusConfig[tenant.status];
  const StatusIcon = status.icon;
  const isCompany = tenant.tenant_type === 'company';
  const displayName = isCompany
    ? (tenant.company_name || `${tenant.first_name} ${tenant.last_name}`)
    : `${tenant.first_name} ${tenant.last_name}`;
  const TenantIcon = isCompany ? Building2 : Users;
  const tenancies = tenant.current_tenancies || [];

  return (
    <Link to={`/tenants/${tenant.id}`}>
      <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <TenantIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                <h3 className="font-semibold truncate">
                  {displayName}
                </h3>
                {isCompany && tenant.company_number && (
                  <Badge variant="outline" className="text-xs shrink-0">
                    {tenant.company_number}
                  </Badge>
                )}
                <Badge variant={status.variant} className="shrink-0">
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {status.label}
                </Badge>
              </div>
              
              <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                {isCompany && tenant.company_contact_name && (
                  <div className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    <span className="truncate">{tenant.company_contact_name}{tenant.company_contact_role ? ` (${tenant.company_contact_role})` : ''}</span>
                  </div>
                )}
                {(tenant.email || tenant.company_contact_email) && (
                  <div className="flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    <span className="truncate">{tenant.email || tenant.company_contact_email}</span>
                  </div>
                )}
                {(tenant.phone || tenant.company_contact_phone) && (
                  <div className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    <span>{tenant.phone || tenant.company_contact_phone}</span>
                  </div>
                )}
              </div>
            </div>

            {tenancies.length > 0 && (
              <div className="text-right shrink-0 max-w-[220px]">
                {tenancies.length === 1 ? (
                  <>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground justify-end mb-0.5">
                      <Home className="h-3 w-3" />
                      <span className="truncate">
                        {tenancies[0].room?.room_name === 'Whole Property'
                          ? tenancies[0].property?.address_line
                          : tenancies[0].room?.room_name}
                      </span>
                    </div>
                    {tenancies[0].room?.room_name !== 'Whole Property' && (
                      <p className="text-xs text-muted-foreground truncate">
                        {tenancies[0].property?.address_line}
                      </p>
                    )}
                    <p className="font-semibold text-foreground">
                      £{tenancies[0].rent_amount_pcm?.toLocaleString()}/mo
                    </p>
                  </>
                ) : (
                  <>
                    <div className="space-y-1.5 mb-2">
                      {tenancies.map((t) => (
                        <div key={t.id} className="flex items-center justify-between gap-3 text-sm">
                          <div className="flex items-center gap-1 text-muted-foreground min-w-0">
                            <Home className="h-3 w-3 shrink-0" />
                            <span className="truncate text-xs">
                              {t.room?.room_name === 'Whole Property'
                                ? t.property?.address_line
                                : t.room?.room_name}
                            </span>
                          </div>
                          <span className="text-xs font-medium whitespace-nowrap">
                            £{t.rent_amount_pcm?.toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="border-t pt-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {tenancies.length} properties
                        </span>
                        <span className="font-semibold text-foreground">
                          £{tenant.total_rent_pcm.toLocaleString()}/mo
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
 
 export default function Tenants() {
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [showAddDialog, setShowAddDialog] = useState(false);
 
   const { data: tenants, isLoading } = useTenantsWithProperty();
 
   const filteredTenants = tenants?.filter(tenant => {
     const searchText = tenant.tenant_type === 'company'
       ? `${tenant.company_name || ''} ${tenant.company_contact_name || ''} ${tenant.company_number || ''}`
       : `${tenant.first_name} ${tenant.last_name}`;
     const matchesSearch = search === '' || 
       searchText.toLowerCase().includes(search.toLowerCase()) ||
       tenant.email?.toLowerCase().includes(search.toLowerCase());
     
     const matchesStatus = statusFilter === 'all' || tenant.status === statusFilter;
     const matchesType = typeFilter === 'all' || tenant.tenant_type === typeFilter;
     
     return matchesSearch && matchesStatus && matchesType;
   }) || [];
 
  const stats = {
    total: tenants?.length || 0,
    active: tenants?.filter(t => t.status === 'active').length || 0,
    prospect: tenants?.filter(t => t.status === 'prospect').length || 0,
    past: tenants?.filter(t => t.status === 'past').length || 0,
    companies: tenants?.filter(t => t.tenant_type === 'company').length || 0,
    individuals: tenants?.filter(t => t.tenant_type === 'individual').length || 0,
    totalRent: tenants
      ?.filter(t => t.status === 'active')
      .reduce((sum, t) => sum + (t.total_rent_pcm || 0), 0) || 0,
  };
 
  if (isLoading) return <AppLayout><LoadingState text="Loading tenants..." /></AppLayout>;
 
   return (
     <AppLayout>
       <div className="space-y-6 p-4 lg:p-6">
         <div className="flex items-center justify-between">
           <div>
             <h1 className="text-2xl font-bold flex items-center gap-2">
               <Users className="h-6 w-6" />
               Tenants
             </h1>
             <p className="text-muted-foreground">Manage tenant profiles and tenancies</p>
           </div>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Tenant
           </Button>
         </div>
 
         {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Tenants</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">{stats.companies} companies · {stats.individuals} individuals</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">{stats.active}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Prospects</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-blue-600">{stats.prospect}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Past</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-muted-foreground">{stats.past}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Rent</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-emerald-600">£{stats.totalRent.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">from {stats.active} active tenants</p>
            </CardContent>
          </Card>
        </div>
 
         {/* Search and Filter */}
         <div className="flex gap-4">
           <div className="relative flex-1">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
             <Input
               placeholder="Search tenants..."
               aria-label="Search tenants"
               value={search}
               onChange={(e) => setSearch(e.target.value)}
               className="pl-10"
             />
           </div>
         </div>
 
         {/* Type + Status Filters */}
         <div className="flex flex-wrap gap-4">
           <Tabs value={typeFilter} onValueChange={setTypeFilter}>
             <TabsList>
               <TabsTrigger value="all">All</TabsTrigger>
               <TabsTrigger value="company">
                 <Building2 className="h-3 w-3 mr-1" />
                 Companies ({stats.companies})
               </TabsTrigger>
               <TabsTrigger value="individual">
                 <Users className="h-3 w-3 mr-1" />
                 Individuals ({stats.individuals})
               </TabsTrigger>
             </TabsList>
           </Tabs>
           <Tabs value={statusFilter} onValueChange={setStatusFilter}>
             <TabsList>
               <TabsTrigger value="all">All ({stats.total})</TabsTrigger>
               <TabsTrigger value="active">Active ({stats.active})</TabsTrigger>
               <TabsTrigger value="prospect">Prospects ({stats.prospect})</TabsTrigger>
               <TabsTrigger value="past">Past ({stats.past})</TabsTrigger>
             </TabsList>
           </Tabs>
         </div>

         {filteredTenants.length === 0 ? (
           <EmptyState
             icon={Users}
             title="No tenants found"
             description={search ? "Try adjusting your search" : "Add your first tenant to get started"}
             action={{ label: "Add Tenant", onClick: () => setShowAddDialog(true) }}
           />
         ) : (
           <div className="grid gap-3">
             {filteredTenants.map(tenant => (
               <TenantCard key={tenant.id} tenant={tenant} />
             ))}
           </div>
         )}

         <AddTenantDialog open={showAddDialog} onOpenChange={setShowAddDialog} />
       </div>
     </AppLayout>
   );
 }
