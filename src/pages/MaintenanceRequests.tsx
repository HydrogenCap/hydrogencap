 import { useState } from 'react';
 import { Link } from 'react-router-dom';
 import { Wrench, Plus, AlertTriangle, Clock, CheckCircle2, Home, User } from 'lucide-react';
 import { format } from 'date-fns';
 import { Button } from '@/components/ui/button';
 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
 import { Badge } from '@/components/ui/badge';
 import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
 import { useMaintenanceRequests, MaintenanceStatus, MaintenanceUrgency, MaintenanceRequestWithDetails } from '@/hooks/useMaintenanceRequests';
 import { LoadingState, EmptyState } from '@/components/common';
 
 const urgencyConfig: Record<MaintenanceUrgency, { label: string; color: string }> = {
   emergency: { label: 'Emergency', color: 'bg-red-100 text-red-800 border-red-200' },
   urgent: { label: 'Urgent', color: 'bg-orange-100 text-orange-800 border-orange-200' },
   normal: { label: 'Normal', color: 'bg-blue-100 text-blue-800 border-blue-200' },
   low: { label: 'Low', color: 'bg-gray-100 text-gray-800 border-gray-200' },
 };
 
 const statusConfig: Record<MaintenanceStatus, { label: string; icon: React.ElementType }> = {
   new: { label: 'New', icon: AlertTriangle },
   acknowledged: { label: 'Acknowledged', icon: Clock },
   scheduled: { label: 'Scheduled', icon: Clock },
   in_progress: { label: 'In Progress', icon: Wrench },
   completed: { label: 'Completed', icon: CheckCircle2 },
   closed: { label: 'Closed', icon: CheckCircle2 },
 };
 
 const categoryLabels: Record<string, string> = {
   plumbing: 'Plumbing',
   electrical: 'Electrical',
   heating: 'Heating',
   appliance: 'Appliance',
   damp_mould: 'Damp/Mould',
   structural: 'Structural',
   security: 'Security',
   cleaning: 'Cleaning',
   garden: 'Garden',
   other: 'Other',
 };
 
 function RequestCard({ request }: { request: MaintenanceRequestWithDetails }) {
   const urgency = urgencyConfig[request.urgency];
   const status = statusConfig[request.status];
   const StatusIcon = status.icon;
 
   return (
     <Link to={`/maintenance/${request.id}`}>
       <Card className={`hover:bg-accent/50 transition-colors cursor-pointer ${request.urgency === 'emergency' ? 'border-red-300' : ''}`}>
         <CardContent className="p-4">
           <div className="flex items-start justify-between gap-4">
             <div className="flex-1 min-w-0">
               <div className="flex items-center gap-2 mb-1 flex-wrap">
                 <Badge variant="outline" className={urgency.color}>
                   {urgency.label}
                 </Badge>
                 <Badge variant="secondary">
                   <StatusIcon className="h-3 w-3 mr-1" />
                   {status.label}
                 </Badge>
                 <Badge variant="outline">{categoryLabels[request.category]}</Badge>
               </div>
               <h4 className="font-medium">{request.title}</h4>
               <p className="text-sm text-muted-foreground line-clamp-1">{request.description}</p>
               
               <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                 <div className="flex items-center gap-1">
                   <Home className="h-3 w-3" />
                   <span className="truncate max-w-[150px]">{request.property.address_line}</span>
                 </div>
                 {request.tenant && (
                   <div className="flex items-center gap-1">
                     <User className="h-3 w-3" />
                     <span>{request.tenant.first_name} {request.tenant.last_name}</span>
                   </div>
                 )}
               </div>
             </div>
 
             <div className="text-right text-sm text-muted-foreground shrink-0">
               <p>{format(new Date(request.created_at), 'dd MMM yyyy')}</p>
               {request.scheduled_date && (
                 <p className="text-primary">Scheduled: {format(new Date(request.scheduled_date), 'dd MMM')}</p>
               )}
             </div>
           </div>
         </CardContent>
       </Card>
     </Link>
   );
 }
 
 export default function MaintenanceRequests() {
    const [statusFilter, setStatusFilter] = useState<string>('open');
 
   const { data: requests, isLoading } = useMaintenanceRequests();
 
   const openRequests = requests?.filter(r => !['completed', 'closed'].includes(r.status)) || [];
   const completedRequests = requests?.filter(r => ['completed', 'closed'].includes(r.status)) || [];
 
   const stats = {
     total: requests?.length || 0,
     open: openRequests.length,
     emergency: openRequests.filter(r => r.urgency === 'emergency').length,
     urgent: openRequests.filter(r => r.urgency === 'urgent').length,
   };
 
  if (isLoading) return <LoadingState text="Loading maintenance requests..." />;
 
   return (
     <div className="container py-6 space-y-6">
       {/* Header */}
       <div className="flex items-center justify-between">
         <div>
           <h1 className="text-2xl font-bold flex items-center gap-2">
             <Wrench className="h-6 w-6" />
             Maintenance Requests
           </h1>
           <p className="text-muted-foreground">Track and manage maintenance issues</p>
         </div>
          <Button disabled title="Coming soon">
            <Plus className="h-4 w-4 mr-2" />
            New Request
         </Button>
       </div>
 
       {/* Stats */}
       <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
         <Card>
           <CardHeader className="pb-2">
             <CardTitle className="text-sm font-medium text-muted-foreground">Open Requests</CardTitle>
           </CardHeader>
           <CardContent>
             <p className="text-2xl font-bold">{stats.open}</p>
           </CardContent>
         </Card>
         {stats.emergency > 0 && (
           <Card className="border-red-200">
             <CardHeader className="pb-2">
               <CardTitle className="text-sm font-medium text-red-600">Emergency</CardTitle>
             </CardHeader>
             <CardContent>
               <p className="text-2xl font-bold text-red-600">{stats.emergency}</p>
             </CardContent>
           </Card>
         )}
         {stats.urgent > 0 && (
           <Card className="border-orange-200">
             <CardHeader className="pb-2">
               <CardTitle className="text-sm font-medium text-orange-600">Urgent</CardTitle>
             </CardHeader>
             <CardContent>
               <p className="text-2xl font-bold text-orange-600">{stats.urgent}</p>
             </CardContent>
           </Card>
         )}
         <Card>
           <CardHeader className="pb-2">
             <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
           </CardHeader>
           <CardContent>
             <p className="text-2xl font-bold text-green-600">{completedRequests.length}</p>
           </CardContent>
         </Card>
       </div>
 
       {/* Request List */}
       <Tabs value={statusFilter} onValueChange={setStatusFilter}>
         <TabsList>
           <TabsTrigger value="open">Open ({stats.open})</TabsTrigger>
           <TabsTrigger value="completed">Completed ({completedRequests.length})</TabsTrigger>
           <TabsTrigger value="all">All ({stats.total})</TabsTrigger>
         </TabsList>
 
         <TabsContent value="open" className="mt-4 space-y-3">
           {openRequests.length === 0 ? (
             <EmptyState
               icon={CheckCircle2}
               title="No open requests"
               description="All maintenance requests have been resolved"
             />
           ) : (
             openRequests
               .sort((a, b) => {
                 const urgencyOrder = { emergency: 0, urgent: 1, normal: 2, low: 3 };
                 return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
               })
               .map(request => <RequestCard key={request.id} request={request} />)
           )}
         </TabsContent>
 
         <TabsContent value="completed" className="mt-4 space-y-3">
           {completedRequests.length === 0 ? (
             <EmptyState
               icon={Wrench}
               title="No completed requests"
               description="Completed maintenance requests will appear here"
             />
           ) : (
             completedRequests.map(request => <RequestCard key={request.id} request={request} />)
           )}
         </TabsContent>
 
         <TabsContent value="all" className="mt-4 space-y-3">
           {requests?.length === 0 ? (
             <EmptyState
               icon={Wrench}
               title="No maintenance requests"
               description="Create a request when issues need to be tracked"
                action={
                 { label: "New Request", onClick: () => {} }
                }
             />
           ) : (
             requests?.map(request => <RequestCard key={request.id} request={request} />)
           )}
         </TabsContent>
       </Tabs>
 
      {/* Maintenance dialog — coming soon */}
     </div>
   );
 }