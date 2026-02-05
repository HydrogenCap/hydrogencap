 import React from 'react';
 import { format } from 'date-fns';
 import { Home, Building2 } from 'lucide-react';
 import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
 import { Badge } from '@/components/ui/badge';
 import { ScrollArea } from '@/components/ui/scroll-area';
 import { Skeleton } from '@/components/ui/skeleton';
 import { usePropertyComparables } from '@/hooks/usePropertyValuations';
 
 interface ComparableSalesTableProps {
   propertyId: string;
 }
 
 const PROPERTY_TYPE_LABELS: Record<string, string> = {
   'D': 'Detached',
   'S': 'Semi-Detached',
   'T': 'Terraced',
   'F': 'Flat',
   'O': 'Other',
   'detached': 'Detached',
   'semi-detached': 'Semi-Detached',
   'terraced': 'Terraced',
   'flat-maisonette': 'Flat',
 };
 
 const PROPERTY_TYPE_ICONS: Record<string, React.ElementType> = {
   'D': Home,
   'S': Home,
   'T': Home,
   'F': Building2,
   'detached': Home,
   'semi-detached': Home,
   'terraced': Home,
   'flat-maisonette': Building2,
 };
 
 function formatGBP(value: number): string {
   return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(value);
 }
 
 export function ComparableSalesTable({ propertyId }: ComparableSalesTableProps) {
   const { data: comparables, isLoading } = usePropertyComparables(propertyId);
 
   if (isLoading) {
     return (
       <Card>
         <CardHeader>
           <CardTitle>Comparable Sales</CardTitle>
         </CardHeader>
         <CardContent>
           <div className="space-y-3">
             {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
           </div>
         </CardContent>
       </Card>
     );
   }
 
   if (!comparables?.length) {
     return (
       <Card>
         <CardHeader>
           <CardTitle>Comparable Sales</CardTitle>
           <CardDescription>Recent sales in the area</CardDescription>
         </CardHeader>
         <CardContent>
           <p className="text-sm text-muted-foreground text-center py-8">
             No comparable sales found. Try refreshing the valuation.
           </p>
         </CardContent>
       </Card>
     );
   }
 
   const avgPrice = Math.round(comparables.reduce((s, c) => s + c.price_paid, 0) / comparables.length);
   const minPrice = Math.min(...comparables.map(c => c.price_paid));
   const maxPrice = Math.max(...comparables.map(c => c.price_paid));
 
   return (
     <Card>
       <CardHeader>
         <CardTitle>Comparable Sales</CardTitle>
         <CardDescription>
           {comparables.length} sales in the last 24 months • Avg: {formatGBP(avgPrice)}
         </CardDescription>
       </CardHeader>
       <CardContent className="p-0">
         {/* Summary stats */}
         <div className="grid grid-cols-3 gap-4 p-4 bg-muted/30 border-b">
           <div className="text-center">
             <p className="text-xs text-muted-foreground">Lowest</p>
             <p className="text-sm font-semibold">{formatGBP(minPrice)}</p>
           </div>
           <div className="text-center">
             <p className="text-xs text-muted-foreground">Average</p>
             <p className="text-sm font-semibold text-primary">{formatGBP(avgPrice)}</p>
           </div>
           <div className="text-center">
             <p className="text-xs text-muted-foreground">Highest</p>
             <p className="text-sm font-semibold">{formatGBP(maxPrice)}</p>
           </div>
         </div>
 
         {/* Sales list */}
         <ScrollArea className="h-[400px]">
           <div className="divide-y">
             {comparables.map((sale) => {
               const Icon = PROPERTY_TYPE_ICONS[sale.property_type] || Home;
               const typeLabel = PROPERTY_TYPE_LABELS[sale.property_type] || sale.property_type;
               
               return (
                 <div key={sale.id} className="p-4 hover:bg-muted/30 transition-colors">
                   <div className="flex items-start justify-between gap-3">
                     <div className="flex items-start gap-3 min-w-0 flex-1">
                       <div className="p-2 rounded-lg bg-muted shrink-0">
                         <Icon className="h-4 w-4 text-muted-foreground" />
                       </div>
                       <div className="min-w-0 flex-1">
                         <p className="font-medium text-sm truncate">{sale.address}</p>
                         <div className="flex items-center gap-2 mt-1 flex-wrap">
                           <Badge variant="outline" className="text-xs">
                             {typeLabel}
                           </Badge>
                           {sale.new_build && (
                             <Badge variant="secondary" className="text-xs">New Build</Badge>
                           )}
                           <span className="text-xs text-muted-foreground">
                             {sale.tenure === 'freehold' ? 'Freehold' : sale.tenure === 'leasehold' ? 'Leasehold' : sale.tenure}
                           </span>
                         </div>
                       </div>
                     </div>
                     <div className="text-right shrink-0">
                       <p className="font-semibold">{formatGBP(sale.price_paid)}</p>
                       <p className="text-xs text-muted-foreground">
                         {format(new Date(sale.sale_date), 'MMM yyyy')}
                       </p>
                     </div>
                   </div>
                 </div>
               );
             })}
           </div>
         </ScrollArea>
       </CardContent>
     </Card>
   );
 }