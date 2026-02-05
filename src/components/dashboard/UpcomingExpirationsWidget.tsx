 import { Link } from 'react-router-dom';
 import { format, differenceInDays } from 'date-fns';
 import { Shield, ChevronRight } from 'lucide-react';
 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
 import { Badge } from '@/components/ui/badge';
 import { Button } from '@/components/ui/button';
 import { Skeleton } from '@/components/ui/skeleton';
 import { useUpcomingComplianceEvents } from '@/hooks/useCalendarEvents';
 import { cn } from '@/lib/utils';
 
 export function UpcomingExpirationsWidget() {
   const { events, isLoading } = useUpcomingComplianceEvents(60);
 
   // Group by urgency
   const overdue = events.filter(e => e.urgency === 'overdue');
   const urgent = events.filter(e => e.urgency === 'urgent');
   const warning = events.filter(e => e.urgency === 'warning');
 
   if (isLoading) {
     return (
       <Card>
         <CardHeader className="pb-2">
           <Skeleton className="h-5 w-40" />
         </CardHeader>
         <CardContent>
           <div className="space-y-2">
             {[1, 2, 3].map(i => (
               <Skeleton key={i} className="h-16" />
             ))}
           </div>
         </CardContent>
       </Card>
     );
   }
 
   return (
     <Card className={cn(
       overdue.length > 0 && 'border-destructive/50',
       overdue.length === 0 && urgent.length > 0 && 'border-amber-500/50'
     )}>
       <CardHeader className="pb-2">
         <div className="flex items-center justify-between">
           <CardTitle className="text-base flex items-center gap-2">
             <Shield className="h-5 w-5 text-primary" />
             Compliance Expiring
           </CardTitle>
           <Link to="/compliance-calendar">
             <Button variant="ghost" size="sm">View Calendar</Button>
           </Link>
         </div>
       </CardHeader>
       <CardContent>
         {events.length === 0 ? (
           <div className="text-center py-6 text-muted-foreground">
             <Shield className="h-10 w-10 mx-auto mb-2 opacity-30" />
             <p className="text-sm">All compliance up to date</p>
           </div>
         ) : (
           <div className="space-y-3">
             {/* Summary badges */}
             <div className="flex flex-wrap gap-2">
               {overdue.length > 0 && (
                 <Badge variant="destructive">
                   {overdue.length} expired
                 </Badge>
               )}
               {urgent.length > 0 && (
                 <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                   {urgent.length} urgent (&lt;14 days)
                 </Badge>
               )}
               {warning.length > 0 && (
                 <Badge variant="secondary">
                   {warning.length} upcoming
                 </Badge>
               )}
             </div>
 
             {/* Top 5 items */}
             <div className="space-y-2">
               {events.slice(0, 5).map(event => {
                 const daysUntil = event.daysUntil;
                 
                 return (
                   <Link
                     key={event.id}
                     to={`/properties/${event.propertyId}?tab=compliance`}
                     className={cn(
                       'flex items-center justify-between p-2.5 rounded-lg border hover:bg-muted/50 transition-colors',
                       event.urgency === 'overdue' && 'bg-destructive/5 border-destructive/30',
                       event.urgency === 'urgent' && 'bg-amber-50 border-amber-200 dark:bg-amber-950/20'
                     )}
                   >
                     <div className="flex-1 min-w-0">
                       <p className="text-sm font-medium truncate">{event.title}</p>
                       <p className="text-xs text-muted-foreground truncate">
                         {event.propertyAddress?.split(',')[0]}
                       </p>
                     </div>
                     <div className="text-right shrink-0 ml-2">
                       <p className={cn(
                         'text-sm font-medium',
                         daysUntil < 0 && 'text-destructive',
                         daysUntil >= 0 && daysUntil <= 14 && 'text-amber-600'
                       )}>
                         {daysUntil < 0 
                           ? `${Math.abs(daysUntil)}d overdue`
                           : daysUntil === 0 
                             ? 'Today'
                             : `${daysUntil}d`
                         }
                       </p>
                       <p className="text-xs text-muted-foreground">
                         {format(event.date, 'dd MMM')}
                       </p>
                     </div>
                   </Link>
                 );
               })}
             </div>
 
             {events.length > 5 && (
               <Link to="/compliance-calendar" className="block">
                 <Button variant="outline" className="w-full" size="sm">
                   View all {events.length} items
                   <ChevronRight className="h-4 w-4 ml-1" />
                 </Button>
               </Link>
             )}
           </div>
         )}
       </CardContent>
     </Card>
   );
 }