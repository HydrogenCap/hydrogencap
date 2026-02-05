 import React from 'react';
 import { TrendingUp, TrendingDown, RefreshCw, Info, Loader2 } from 'lucide-react';
 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
 import { Button } from '@/components/ui/button';
 import { Badge } from '@/components/ui/badge';
 import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
 import { usePropertyValuationHistory, useTriggerValuation } from '@/hooks/usePropertyValuations';
 import { formatDistanceToNow } from 'date-fns';
 import { cn } from '@/lib/utils';
 
 interface PropertyValuationCardProps {
   propertyId: string;
   recordedValue: number;
   lastEstimate?: number;
   lastValuationDate?: string;
   changePercent?: number;
   confidence?: string;
 }
 
 function formatGBP(value: number): string {
   return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(value);
 }
 
 export function PropertyValuationCard({
   propertyId,
   recordedValue,
   lastEstimate,
   lastValuationDate,
   changePercent,
   confidence,
 }: PropertyValuationCardProps) {
   const { data: history, isLoading: historyLoading } = usePropertyValuationHistory(propertyId);
   const triggerValuation = useTriggerValuation();
 
   const latestValuation = history?.[0];
   const displayEstimate = lastEstimate || latestValuation?.estimated_value_gbp;
   const displayChange = changePercent ?? (recordedValue && displayEstimate 
     ? ((displayEstimate - recordedValue) / recordedValue) * 100 
     : 0);
   const displayConfidence = confidence || latestValuation?.confidence_level;
   const displayDate = lastValuationDate || latestValuation?.valuation_date;
 
   const handleRefresh = () => {
     triggerValuation.mutate(propertyId);
   };
 
   const confidenceColors = {
     high: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
     medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
     low: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
   };
 
   return (
     <Card>
       <CardHeader className="pb-2">
         <div className="flex items-center justify-between">
           <CardTitle className="text-base flex items-center gap-2">
             AI Valuation Estimate
             <Tooltip>
               <TooltipTrigger>
                 <Info className="h-4 w-4 text-muted-foreground" />
               </TooltipTrigger>
               <TooltipContent className="max-w-xs">
                 <p>Estimated using Land Registry comparable sales and AI analysis. Updated monthly.</p>
               </TooltipContent>
             </Tooltip>
           </CardTitle>
           <Button 
             variant="ghost" 
             size="sm" 
             onClick={handleRefresh}
             disabled={triggerValuation.isPending}
           >
             {triggerValuation.isPending ? (
               <Loader2 className="h-4 w-4 animate-spin" />
             ) : (
               <RefreshCw className="h-4 w-4" />
             )}
           </Button>
         </div>
       </CardHeader>
       <CardContent>
         {displayEstimate ? (
           <div className="space-y-4">
             {/* Main estimate */}
             <div>
               <div className="flex items-baseline gap-2">
                 <span className="text-2xl font-bold">{formatGBP(displayEstimate)}</span>
                 {displayConfidence && (
                   <Badge className={cn('text-xs', confidenceColors[displayConfidence as keyof typeof confidenceColors])}>
                     {displayConfidence} confidence
                   </Badge>
                 )}
               </div>
               {displayDate && (
                 <p className="text-xs text-muted-foreground mt-1">
                   Updated {formatDistanceToNow(new Date(displayDate), { addSuffix: true })}
                 </p>
               )}
             </div>
 
             {/* Comparison to recorded value */}
             {recordedValue > 0 && (
               <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                 <div>
                   <p className="text-xs text-muted-foreground">vs Recorded Value</p>
                   <p className="text-sm font-medium">{formatGBP(recordedValue)}</p>
                 </div>
                 <div className={cn(
                   'flex items-center gap-1 px-2 py-1 rounded',
                   displayChange > 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 
                   displayChange < 0 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 
                   'bg-muted text-muted-foreground'
                 )}>
                   {displayChange > 0 ? (
                     <TrendingUp className="h-4 w-4" />
                   ) : displayChange < 0 ? (
                     <TrendingDown className="h-4 w-4" />
                   ) : null}
                   <span className="text-sm font-medium">
                     {displayChange > 0 ? '+' : ''}{displayChange.toFixed(1)}%
                   </span>
                 </div>
               </div>
             )}
 
             {/* Comparables info */}
             {latestValuation?.comparables_count && (
               <p className="text-xs text-muted-foreground">
                 Based on {latestValuation.comparables_count} comparable sales
                 {latestValuation.comparables_avg_price && (
                   <> (avg {formatGBP(latestValuation.comparables_avg_price)})</>
                 )}
               </p>
             )}
           </div>
         ) : (
           <div className="text-center py-4">
             <p className="text-sm text-muted-foreground mb-3">No valuation estimate yet</p>
             <Button onClick={handleRefresh} disabled={triggerValuation.isPending}>
               {triggerValuation.isPending ? (
                 <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating...</>
               ) : (
                 'Generate Estimate'
               )}
             </Button>
           </div>
         )}
       </CardContent>
     </Card>
   );
 }