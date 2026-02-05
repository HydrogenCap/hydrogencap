 import { useState, useMemo } from 'react';
 import { PoundSterling, Calendar, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle2, Clock, TrendingUp } from 'lucide-react';
 import { format, addMonths, subMonths, startOfMonth } from 'date-fns';
 import { Button } from '@/components/ui/button';
 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
 import { Badge } from '@/components/ui/badge';
 import { Progress } from '@/components/ui/progress';
 import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
 import { useRentSchedule, useArrears, RentStatus, RentScheduleWithDetails } from '@/hooks/useRentCollection';
 import { LoadingState, EmptyState } from '@/components/common';
 
 const statusConfig: Record<RentStatus, { label: string; color: string; icon: React.ElementType }> = {
   upcoming: { label: 'Upcoming', color: 'bg-gray-100 text-gray-800', icon: Clock },
   due: { label: 'Due Today', color: 'bg-blue-100 text-blue-800', icon: Calendar },
   paid: { label: 'Paid', color: 'bg-green-100 text-green-800', icon: CheckCircle2 },
   partial: { label: 'Partial', color: 'bg-amber-100 text-amber-800', icon: AlertTriangle },
   overdue: { label: 'Overdue', color: 'bg-red-100 text-red-800', icon: AlertTriangle },
 };
 
 function RentScheduleRow({ item, onRecordPayment }: { item: RentScheduleWithDetails; onRecordPayment: () => void }) {
   const status = statusConfig[item.status];
   const StatusIcon = status.icon;
 
   return (
     <Card className={item.status === 'overdue' ? 'border-red-200' : ''}>
       <CardContent className="p-4">
         <div className="flex items-start justify-between gap-4">
           <div className="flex-1 min-w-0">
             <div className="flex items-center gap-2 mb-1">
               <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                 <StatusIcon className="h-3 w-3" />
                 {status.label}
               </span>
               <span className="text-sm text-muted-foreground">
                 Due: {format(new Date(item.due_date), 'dd MMM yyyy')}
               </span>
             </div>
             <h4 className="font-medium">
               {item.tenancy.tenant.first_name} {item.tenancy.tenant.last_name}
             </h4>
             <p className="text-sm text-muted-foreground">
               {item.tenancy.room.room_name} • {item.tenancy.property.address_line}
             </p>
           </div>
 
           <div className="text-right shrink-0">
             <p className="text-lg font-semibold">£{item.rent_amount.toLocaleString()}</p>
             {item.amount_paid > 0 && (
               <p className="text-sm text-green-600">Paid: £{item.amount_paid.toLocaleString()}</p>
             )}
             {item.amount_outstanding > 0 && item.status !== 'upcoming' && (
               <p className="text-sm text-red-600">Owed: £{item.amount_outstanding.toLocaleString()}</p>
             )}
           </div>
 
           {item.status !== 'paid' && (
             <Button size="sm" onClick={onRecordPayment}>
               Record Payment
             </Button>
           )}
         </div>
       </CardContent>
     </Card>
   );
 }
 
 export default function RentCollection() {
   const [selectedMonth, setSelectedMonth] = useState(startOfMonth(new Date()));
   const [paymentItem, setPaymentItem] = useState<RentScheduleWithDetails | null>(null);
 
   const monthStr = format(selectedMonth, 'yyyy-MM');
   const { data: schedule, isLoading } = useRentSchedule({ month: monthStr });
   const { data: arrears } = useArrears();
 
   const summary = useMemo(() => {
     if (!schedule) return null;
     const totalExpected = schedule.reduce((sum, item) => sum + item.rent_amount + item.additional_charges, 0);
     const totalReceived = schedule.reduce((sum, item) => sum + item.amount_paid, 0);
     const totalOutstanding = schedule.reduce((sum, item) => sum + item.amount_outstanding, 0);
     return {
       totalExpected,
       totalReceived,
       totalOutstanding,
       collectionRate: totalExpected > 0 ? Math.round((totalReceived / totalExpected) * 100) : 0,
       counts: {
         paid: schedule.filter(s => s.status === 'paid').length,
         partial: schedule.filter(s => s.status === 'partial').length,
         overdue: schedule.filter(s => s.status === 'overdue').length,
         due: schedule.filter(s => s.status === 'due').length,
         upcoming: schedule.filter(s => s.status === 'upcoming').length,
       }
     };
   }, [schedule]);
 
  if (isLoading) return <LoadingState text="Loading rent schedule..." />;
 
   return (
     <div className="container py-6 space-y-6">
       {/* Header */}
       <div className="flex items-center justify-between">
         <div>
           <h1 className="text-2xl font-bold flex items-center gap-2">
             <PoundSterling className="h-6 w-6" />
             Rent Collection
           </h1>
           <p className="text-muted-foreground">Track rent payments and arrears</p>
         </div>
       </div>
 
       {/* Month Navigator */}
       <div className="flex items-center justify-center gap-4">
         <Button variant="outline" size="icon" onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))}>
           <ChevronLeft className="h-4 w-4" />
         </Button>
         <h2 className="text-xl font-semibold min-w-[200px] text-center">
           {format(selectedMonth, 'MMMM yyyy')}
         </h2>
         <Button variant="outline" size="icon" onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))}>
           <ChevronRight className="h-4 w-4" />
         </Button>
       </div>
 
       {/* Summary Cards */}
       {summary && (
         <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
           <Card>
             <CardHeader className="pb-2">
               <CardTitle className="text-sm font-medium text-muted-foreground">Expected</CardTitle>
             </CardHeader>
             <CardContent>
               <p className="text-2xl font-bold">£{summary.totalExpected.toLocaleString()}</p>
             </CardContent>
           </Card>
           <Card className="border-green-200">
             <CardHeader className="pb-2">
               <CardTitle className="text-sm font-medium text-muted-foreground">Received</CardTitle>
             </CardHeader>
             <CardContent>
               <p className="text-2xl font-bold text-green-600">£{summary.totalReceived.toLocaleString()}</p>
             </CardContent>
           </Card>
           <Card className={summary.totalOutstanding > 0 ? 'border-red-200' : ''}>
             <CardHeader className="pb-2">
               <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding</CardTitle>
             </CardHeader>
             <CardContent>
               <p className={`text-2xl font-bold ${summary.totalOutstanding > 0 ? 'text-red-600' : ''}`}>
                 £{summary.totalOutstanding.toLocaleString()}
               </p>
             </CardContent>
           </Card>
           <Card>
             <CardHeader className="pb-2">
               <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                 <TrendingUp className="h-4 w-4" />
                 Collection Rate
               </CardTitle>
             </CardHeader>
             <CardContent>
               <p className="text-2xl font-bold">{summary.collectionRate}%</p>
               <Progress value={summary.collectionRate} className="mt-2" />
             </CardContent>
           </Card>
         </div>
       )}
 
       {/* Arrears Alert */}
       {arrears && arrears.length > 0 && (
         <Card className="border-red-200 bg-red-50">
           <CardContent className="py-4">
             <div className="flex items-center gap-3">
               <AlertTriangle className="h-5 w-5 text-red-600" />
               <div>
                 <p className="font-medium text-red-900">
                   {arrears.length} tenant{arrears.length > 1 ? 's' : ''} in arrears
                 </p>
                 <p className="text-sm text-red-700">
                   Total outstanding: £{arrears.reduce((sum, a) => sum + a.amount_outstanding, 0).toLocaleString()}
                 </p>
               </div>
             </div>
           </CardContent>
         </Card>
       )}
 
       {/* Schedule List */}
       <Tabs defaultValue="all">
         <TabsList>
           <TabsTrigger value="all">All ({schedule?.length || 0})</TabsTrigger>
           <TabsTrigger value="action">
             Needs Action ({(summary?.counts.overdue || 0) + (summary?.counts.partial || 0) + (summary?.counts.due || 0)})
           </TabsTrigger>
           <TabsTrigger value="paid">Paid ({summary?.counts.paid || 0})</TabsTrigger>
         </TabsList>
 
         <TabsContent value="all" className="mt-4 space-y-3">
           {schedule?.length === 0 ? (
             <EmptyState
               icon={PoundSterling}
               title="No rent scheduled"
               description="Rent will appear here when tenancies are created"
             />
           ) : (
             schedule?.map(item => (
               <RentScheduleRow 
                 key={item.id} 
                 item={item} 
                 onRecordPayment={() => setPaymentItem(item)} 
               />
             ))
           )}
         </TabsContent>
 
         <TabsContent value="action" className="mt-4 space-y-3">
           {schedule?.filter(s => ['overdue', 'partial', 'due'].includes(s.status)).map(item => (
             <RentScheduleRow 
               key={item.id} 
               item={item} 
               onRecordPayment={() => setPaymentItem(item)} 
             />
           ))}
         </TabsContent>
 
         <TabsContent value="paid" className="mt-4 space-y-3">
           {schedule?.filter(s => s.status === 'paid').map(item => (
             <RentScheduleRow 
               key={item.id} 
               item={item} 
               onRecordPayment={() => setPaymentItem(item)} 
             />
           ))}
         </TabsContent>
       </Tabs>
 
      {/* TODO: Record payment dialog */}
     </div>
   );
 }