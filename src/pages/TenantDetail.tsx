 import { useState } from 'react';
 import { useParams, Link } from 'react-router-dom';
 import { ArrowLeft, Mail, Phone, User, Building2, Calendar, Briefcase, Shield, Home, PoundSterling, Edit, FileText } from 'lucide-react';
 import { format } from 'date-fns';
 import { Button } from '@/components/ui/button';
 import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
 import { Badge } from '@/components/ui/badge';
 import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
 import { Separator } from '@/components/ui/separator';
 import { useTenant, TenantStatus } from '@/hooks/useTenants';
 import { useTenancies } from '@/hooks/useTenancies';
 import { useRentSchedule } from '@/hooks/useRentCollection';
 import { LoadingState } from '@/components/common';
 
 const statusConfig: Record<TenantStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
   prospect: { label: 'Prospect', variant: 'outline' },
   active: { label: 'Active', variant: 'default' },
   past: { label: 'Past', variant: 'secondary' },
   blacklisted: { label: 'Blacklisted', variant: 'destructive' },
 };
 
 export default function TenantDetail() {
   const { tenantId } = useParams<{ tenantId: string }>();
   const [showTenancyDialog, setShowTenancyDialog] = useState(false);
 
   const { data: tenant, isLoading: tenantLoading } = useTenant(tenantId!);
   const { data: tenancies, isLoading: tenanciesLoading } = useTenancies({ tenantId });
 
  if (tenantLoading || tenanciesLoading) return <LoadingState text="Loading tenant..." />;
   if (!tenant) return <div>Tenant not found</div>;
 
   const activeTenancy = tenancies?.find(t => t.status === 'active');
   const status = statusConfig[tenant.status];
 
   return (
     <div className="container py-6 space-y-6">
       {/* Header */}
       <div className="flex items-center gap-4">
         <Button variant="ghost" size="icon" asChild>
           <Link to="/tenants">
             <ArrowLeft className="h-5 w-5" />
           </Link>
         </Button>
         <div className="flex-1">
           <div className="flex items-center gap-3">
             <h1 className="text-2xl font-bold">
               {tenant.first_name} {tenant.last_name}
             </h1>
             <Badge variant={status.variant}>{status.label}</Badge>
           </div>
           {activeTenancy && (
             <p className="text-muted-foreground">
               {activeTenancy.room.room_name} at {activeTenancy.property.address_line}
             </p>
           )}
         </div>
         <Button variant="outline">
           <Edit className="h-4 w-4 mr-2" />
           Edit Tenant
         </Button>
       </div>
 
       <div className="grid lg:grid-cols-3 gap-6">
         {/* Contact & Details */}
         <div className="space-y-6">
           <Card>
             <CardHeader>
               <CardTitle className="text-lg flex items-center gap-2">
                 <User className="h-5 w-5" />
                 Contact Details
               </CardTitle>
             </CardHeader>
             <CardContent className="space-y-3">
               {tenant.email && (
                 <div className="flex items-center gap-2">
                   <Mail className="h-4 w-4 text-muted-foreground" />
                   <a href={`mailto:${tenant.email}`} className="text-primary hover:underline">
                     {tenant.email}
                   </a>
                 </div>
               )}
               {tenant.phone && (
                 <div className="flex items-center gap-2">
                   <Phone className="h-4 w-4 text-muted-foreground" />
                   <a href={`tel:${tenant.phone}`} className="hover:underline">
                     {tenant.phone}
                   </a>
                 </div>
               )}
               {tenant.date_of_birth && (
                 <div className="flex items-center gap-2">
                   <Calendar className="h-4 w-4 text-muted-foreground" />
                   <span>{format(new Date(tenant.date_of_birth), 'dd MMM yyyy')}</span>
                 </div>
               )}
             </CardContent>
           </Card>
 
           {tenant.emergency_contact_name && (
             <Card>
               <CardHeader>
                 <CardTitle className="text-lg flex items-center gap-2">
                   <Shield className="h-5 w-5" />
                   Emergency Contact
                 </CardTitle>
               </CardHeader>
               <CardContent className="space-y-2 text-sm">
                 <p className="font-medium">{tenant.emergency_contact_name}</p>
                 {tenant.emergency_contact_relationship && (
                   <p className="text-muted-foreground">{tenant.emergency_contact_relationship}</p>
                 )}
                 {tenant.emergency_contact_phone && (
                   <a href={`tel:${tenant.emergency_contact_phone}`} className="text-primary hover:underline">
                     {tenant.emergency_contact_phone}
                   </a>
                 )}
               </CardContent>
             </Card>
           )}
 
           {tenant.employer_name && (
             <Card>
               <CardHeader>
                 <CardTitle className="text-lg flex items-center gap-2">
                   <Briefcase className="h-5 w-5" />
                   Employment
                 </CardTitle>
               </CardHeader>
               <CardContent className="space-y-2 text-sm">
                 <p><span className="text-muted-foreground">Status:</span> {tenant.employment_status || 'Not specified'}</p>
                 <p><span className="text-muted-foreground">Employer:</span> {tenant.employer_name}</p>
                 {tenant.annual_income && (
                   <p><span className="text-muted-foreground">Income:</span> £{tenant.annual_income.toLocaleString()}/year</p>
                 )}
               </CardContent>
             </Card>
           )}
         </div>
 
         {/* Tenancy History */}
         <div className="lg:col-span-2">
           <Tabs defaultValue="tenancies">
             <TabsList>
               <TabsTrigger value="tenancies">Tenancies</TabsTrigger>
               <TabsTrigger value="rent">Rent History</TabsTrigger>
               <TabsTrigger value="documents">Documents</TabsTrigger>
             </TabsList>
 
             <TabsContent value="tenancies" className="mt-4 space-y-4">
               <div className="flex justify-between items-center">
                 <h3 className="font-semibold">Tenancy History</h3>
                 {tenant.status !== 'blacklisted' && (
                   <Button onClick={() => setShowTenancyDialog(true)}>
                     <Home className="h-4 w-4 mr-2" />
                     Create Tenancy
                   </Button>
                 )}
               </div>
 
               {tenancies?.length === 0 ? (
                 <Card>
                   <CardContent className="py-8 text-center text-muted-foreground">
                     No tenancies yet
                   </CardContent>
                 </Card>
               ) : (
                 <div className="space-y-3">
                   {tenancies?.map(tenancy => (
                     <Card key={tenancy.id}>
                       <CardContent className="p-4">
                         <div className="flex justify-between items-start">
                           <div>
                             <div className="flex items-center gap-2 mb-1">
                               <Home className="h-4 w-4" />
                               <span className="font-medium">{tenancy.room.room_name}</span>
                               <Badge variant={
                                 tenancy.status === 'active' ? 'default' :
                                 tenancy.status === 'notice' ? 'secondary' : 'outline'
                               }>
                                 {tenancy.status}
                               </Badge>
                             </div>
                             <p className="text-sm text-muted-foreground">
                               {tenancy.property.address_line}
                             </p>
                             <p className="text-sm text-muted-foreground mt-1">
                               {format(new Date(tenancy.start_date), 'dd MMM yyyy')} - 
                               {tenancy.end_date ? format(new Date(tenancy.end_date), ' dd MMM yyyy') : ' Present'}
                             </p>
                           </div>
                           <div className="text-right">
                             <p className="font-semibold">£{tenancy.rent_amount_pcm.toLocaleString()}/mo</p>
                             <p className="text-xs text-muted-foreground">Due day: {tenancy.rent_due_day}</p>
                           </div>
                         </div>
                       </CardContent>
                     </Card>
                   ))}
                 </div>
               )}
             </TabsContent>
 
             <TabsContent value="rent" className="mt-4">
               <Card>
                 <CardContent className="py-8 text-center text-muted-foreground">
                   <PoundSterling className="h-8 w-8 mx-auto mb-2 opacity-50" />
                   Rent history will be shown here
                 </CardContent>
               </Card>
             </TabsContent>
 
             <TabsContent value="documents" className="mt-4">
               <Card>
                 <CardContent className="py-8 text-center text-muted-foreground">
                   <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                   Tenancy documents will be shown here
                 </CardContent>
               </Card>
             </TabsContent>
           </Tabs>
         </div>
       </div>
 
      {/* TODO: Create tenancy dialog */}
     </div>
   );
 }