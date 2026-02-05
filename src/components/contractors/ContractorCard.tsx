 import React from 'react';
 import { Star, Phone, Mail, CheckCircle } from 'lucide-react';
 import { Card, CardContent } from '@/components/ui/card';
 import { Badge } from '@/components/ui/badge';
 import { type Contractor } from '@/hooks/useContractors';
 import { cn } from '@/lib/utils';
 
 interface ContractorCardProps {
   contractor: Contractor;
   onClick?: () => void;
   selected?: boolean;
 }
 
 export function ContractorCard({ contractor, onClick, selected }: ContractorCardProps) {
   return (
     <Card
       className={cn(
         "cursor-pointer transition-all hover:shadow-md",
         selected && "ring-2 ring-primary"
       )}
       onClick={onClick}
     >
       <CardContent className="p-4">
         <div className="flex items-start justify-between mb-3">
           <div>
             <div className="flex items-center gap-2">
               <h3 className="font-semibold">{contractor.name}</h3>
               {contractor.is_preferred && (
                 <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
               )}
             </div>
             {contractor.company_name && (
               <p className="text-sm text-muted-foreground">{contractor.company_name}</p>
             )}
           </div>
           {contractor.average_rating > 0 && (
             <div className="flex items-center gap-1 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded">
               <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
               <span className="text-sm font-medium">{contractor.average_rating.toFixed(1)}</span>
             </div>
           )}
         </div>
 
         <div className="space-y-1 text-sm text-muted-foreground mb-3">
           {contractor.phone && (
             <div className="flex items-center gap-2">
               <Phone className="h-3 w-3" />
               {contractor.phone}
             </div>
           )}
           {contractor.email && (
             <div className="flex items-center gap-2">
               <Mail className="h-3 w-3" />
               <span className="truncate">{contractor.email}</span>
             </div>
           )}
         </div>
 
         <div className="flex flex-wrap gap-1">
           {contractor.compliance_types.slice(0, 3).map(type => (
             <Badge key={type} variant="secondary" className="text-xs">
               {type.split(' ')[0]}
             </Badge>
           ))}
           {contractor.compliance_types.length > 3 && (
             <Badge variant="outline" className="text-xs">
               +{contractor.compliance_types.length - 3}
             </Badge>
           )}
         </div>
 
         {contractor.total_jobs > 0 && (
           <div className="flex items-center gap-4 mt-3 pt-3 border-t text-xs text-muted-foreground">
             <div className="flex items-center gap-1">
               <CheckCircle className="h-3 w-3" />
               {contractor.total_jobs} jobs completed
             </div>
           </div>
         )}
       </CardContent>
     </Card>
   );
 }