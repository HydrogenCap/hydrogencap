 import { useState } from 'react';
 import { Link } from 'react-router-dom';
 import { Users, Plus, Search, Filter, Mail, Phone, Home, UserCheck, UserX, Clock } from 'lucide-react';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
 import { Badge } from '@/components/ui/badge';
 import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
 import { useTenantsWithProperty, TenantStatus, TenantWithProperty } from '@/hooks/useTenants';
 import { LoadingState, EmptyState } from '@/components/common';
 
 const statusConfig: Record<TenantStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ElementType }> = {
   prospect: { label: 'Prospect', variant: 'outline', icon: Clock },
   active: { label: 'Active', variant: 'default', icon: UserCheck },
   past: { label: 'Past', variant: 'secondary', icon: UserX },
   blacklisted: { label: 'Blacklisted', variant: 'destructive', icon: UserX },
 };
 
 function TenantCard({ tenant }: { tenant: TenantWithProperty }) {
   const status = statusConfig[tenant.status];
   const StatusIcon = status.icon;
 
   return (
     <Link to={`/tenants/${tenant.id}`}>
       <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
         <CardContent className="p-4">
           <div className="flex items-start justify-between gap-4">
             <div className="flex-1 min-w-0">
               <div className="flex items-center gap-2 mb-1">
                 <h3 className="font-semibold truncate">
                   {tenant.first_name} {tenant.last_name}
                 </h3>
                 <Badge variant={status.variant} className="shrink-0">
                   <StatusIcon className="h-3 w-3 mr-1" />
                   {status.label}
                 </Badge>
               </div>
               
               <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                 {tenant.email && (
                   <div className="flex items-center gap-1">
                     <Mail className="h-3 w-3" />
                     <span className="truncate">{tenant.email}</span>
                   </div>
                 )}
                 {tenant.phone && (
                   <div className="flex items-center gap-1">
                     <Phone className="h-3 w-3" />
                     <span>{tenant.phone}</span>
                   </div>
                 )}
               </div>
             </div>
 
             {tenant.current_tenancy && (
               <div className="text-right text-sm shrink-0">
                 <div className="flex items-center gap-1 text-muted-foreground mb-1">
                   <Home className="h-3 w-3" />
                   <span className="truncate max-w-[150px]">
                     {tenant.current_tenancy.room?.room_name}
                   </span>
                 </div>
                 <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                   {tenant.current_tenancy.property?.address_line}
                 </p>
                 <p className="font-medium text-foreground">
                   £{tenant.current_tenancy.rent_amount_pcm?.toLocaleString()}/mo
                 </p>
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
 
   const { data: tenants, isLoading } = useTenantsWithProperty();
 
   const filteredTenants = tenants?.filter(tenant => {
     const matchesSearch = search === '' || 
       `${tenant.first_name} ${tenant.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
       tenant.email?.toLowerCase().includes(search.toLowerCase());
     
     const matchesStatus = statusFilter === 'all' || tenant.status === statusFilter;
     
     return matchesSearch && matchesStatus;
   }) || [];
 
   const stats = {
     total: tenants?.length || 0,
     active: tenants?.filter(t => t.status === 'active').length || 0,
     prospect: tenants?.filter(t => t.status === 'prospect').length || 0,
     past: tenants?.filter(t => t.status === 'past').length || 0,
   };
 
  if (isLoading) return <LoadingState text="Loading tenants..." />;
 
   return (
     <div className="container py-6 space-y-6">
       <div className="flex items-center justify-between">
         <div>
           <h1 className="text-2xl font-bold flex items-center gap-2">
             <Users className="h-6 w-6" />
             Tenants
           </h1>
           <p className="text-muted-foreground">Manage tenant profiles and tenancies</p>
         </div>
          <Button disabled title="Coming soon">
            <Plus className="h-4 w-4 mr-2" />
            Add Tenant
         </Button>
       </div>
 
       {/* Stats Cards */}
       <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
         <Card>
           <CardHeader className="pb-2">
             <CardTitle className="text-sm font-medium text-muted-foreground">Total Tenants</CardTitle>
           </CardHeader>
           <CardContent>
             <p className="text-2xl font-bold">{stats.total}</p>
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
       </div>
 
       {/* Search and Filter */}
       <div className="flex gap-4">
         <div className="relative flex-1">
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
           <Input
             placeholder="Search tenants..."
             value={search}
             onChange={(e) => setSearch(e.target.value)}
             className="pl-10"
           />
         </div>
       </div>
 
       {/* Tabs for Status Filter */}
       <Tabs value={statusFilter} onValueChange={setStatusFilter}>
         <TabsList>
           <TabsTrigger value="all">All ({stats.total})</TabsTrigger>
           <TabsTrigger value="active">Active ({stats.active})</TabsTrigger>
           <TabsTrigger value="prospect">Prospects ({stats.prospect})</TabsTrigger>
           <TabsTrigger value="past">Past ({stats.past})</TabsTrigger>
         </TabsList>
 
         <TabsContent value={statusFilter} className="mt-4">
           {filteredTenants.length === 0 ? (
             <EmptyState
               icon={Users}
               title="No tenants found"
               description={search ? "Try adjusting your search" : "Add your first tenant to get started"}
              action={{ label: "Add Tenant", onClick: () => {} }}
             />
           ) : (
             <div className="grid gap-3">
               {filteredTenants.map(tenant => (
                 <TenantCard key={tenant.id} tenant={tenant} />
               ))}
             </div>
           )}
         </TabsContent>
       </Tabs>
 
      {/* Tenant dialog — coming soon */}
     </div>
   );
 }