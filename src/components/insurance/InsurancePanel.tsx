 import React, { useState } from 'react';
 import { format, differenceInDays } from 'date-fns';
 import { Shield, Plus, Calendar, PoundSterling, EllipsisVertical, Pencil, Trash2 } from 'lucide-react';
 import { Card, CardContent } from '@/components/ui/card';
 import { Button } from '@/components/ui/button';
 import { Badge } from '@/components/ui/badge';
 import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuTrigger,
 } from '@/components/ui/dropdown-menu';
 import {
   useInsurancePolicies,
   useInsuranceTotals,
   useDeleteInsurancePolicy,
   InsurancePolicy,
   POLICY_TYPES,
 } from '@/hooks/useInsurance';
 import { AddInsuranceDialog } from './AddInsuranceDialog';
 import { EditInsuranceDialog } from './EditInsuranceDialog';
 import { formatGBP } from '@/lib/calculations';
 import { cn } from '@/lib/utils';
 
 interface InsurancePanelProps {
   propertyId?: string;
   showTotals?: boolean;
 }
 
 export function InsurancePanel({ propertyId, showTotals = false }: InsurancePanelProps) {
   const [showAddDialog, setShowAddDialog] = useState(false);
   const [editingPolicy, setEditingPolicy] = useState<InsurancePolicy | null>(null);
 
   const { data: policies, isLoading } = useInsurancePolicies({
     propertyId,
   });
 
   const { data: totals } = useInsuranceTotals();
   const deletePolicy = useDeleteInsurancePolicy();
 
   const getExpiryBadge = (renewalDate: string) => {
     const daysUntil = differenceInDays(new Date(renewalDate), new Date());
     
     if (daysUntil < 0) {
       return <Badge variant="destructive">Expired</Badge>;
     }
     if (daysUntil <= 30) {
       return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">Expires in {daysUntil}d</Badge>;
     }
     if (daysUntil <= 60) {
       return <Badge variant="secondary">Expires in {daysUntil}d</Badge>;
     }
     return null;
   };
 
   return (
     <div className="space-y-4">
       {/* Header */}
       <div className="flex items-center justify-between">
         <h3 className="text-lg font-semibold flex items-center gap-2">
           <Shield className="h-5 w-5" />
           Insurance
         </h3>
         <Button size="sm" onClick={() => setShowAddDialog(true)}>
           <Plus className="h-4 w-4 mr-1" />
           Add Policy
         </Button>
       </div>
 
       {/* Totals */}
       {showTotals && totals && (
         <div className="grid grid-cols-3 gap-4">
           <Card>
             <CardContent className="pt-4">
               <p className="text-sm text-muted-foreground">Annual Total</p>
               <p className="text-xl font-bold">{formatGBP(totals.total_annual)}</p>
             </CardContent>
           </Card>
           <Card>
             <CardContent className="pt-4">
               <p className="text-sm text-muted-foreground">Monthly Total</p>
               <p className="text-xl font-bold">{formatGBP(totals.total_monthly)}</p>
             </CardContent>
           </Card>
           <Card>
             <CardContent className="pt-4">
               <p className="text-sm text-muted-foreground">Active Policies</p>
               <p className="text-xl font-bold">{totals.policy_count}</p>
             </CardContent>
           </Card>
         </div>
       )}
 
       {/* Policies List */}
       {isLoading ? (
         <div className="space-y-3">
           {[1, 2].map(i => (
             <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
           ))}
         </div>
       ) : !policies?.length ? (
         <Card>
           <CardContent className="py-8 text-center">
             <Shield className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
             <p className="text-muted-foreground mb-3">No insurance policies</p>
             <Button size="sm" onClick={() => setShowAddDialog(true)}>
               <Plus className="h-4 w-4 mr-1" />
               Add Policy
             </Button>
           </CardContent>
         </Card>
       ) : (
         <div className="space-y-3">
           {policies.map(policy => {
             const policyType = POLICY_TYPES.find(t => t.value === policy.policy_type);
             const daysUntilExpiry = differenceInDays(new Date(policy.renewal_date), new Date());
 
             return (
               <Card
                 key={policy.id}
                 className={cn(
                   daysUntilExpiry < 0 && "border-red-200 bg-red-50/50 dark:border-red-900/50 dark:bg-red-950/20",
                   daysUntilExpiry >= 0 && daysUntilExpiry <= 30 && "border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20"
                 )}
               >
                 <CardContent className="p-4">
                   <div className="flex items-start justify-between">
                     <div className="flex-1">
                       <div className="flex items-center gap-2 mb-1 flex-wrap">
                         <h4 className="font-medium">{policy.insurer_name}</h4>
                         {policyType && <Badge variant="outline">{policyType.label}</Badge>}
                         {policy.cover_type && !policyType && <Badge variant="outline">{policy.cover_type}</Badge>}
                         {getExpiryBadge(policy.renewal_date)}
                       </div>
                       
                       {policy.policy_number && (
                         <p className="text-sm text-muted-foreground">
                           Policy: {policy.policy_number}
                         </p>
                       )}
 
                       {!propertyId && policy.property && (
                         <p className="text-sm text-muted-foreground">
                           {policy.property.address_line?.split(',')[0]}
                         </p>
                       )}
 
                       <div className="flex items-center gap-4 mt-2 text-sm">
                         <span className="flex items-center gap-1">
                           <PoundSterling className="h-3 w-3" />
                           {formatGBP(policy.premium_gbp)}/year
                         </span>
                         <span className="flex items-center gap-1 text-muted-foreground">
                           <Calendar className="h-3 w-3" />
                           Renews {format(new Date(policy.renewal_date), 'dd MMM yyyy')}
                         </span>
                       </div>
                     </div>
 
                     <DropdownMenu>
                       <DropdownMenuTrigger asChild>
                         <Button variant="ghost" size="icon" className="h-8 w-8">
                           <EllipsisVertical className="h-4 w-4" />
                         </Button>
                       </DropdownMenuTrigger>
                       <DropdownMenuContent align="end">
                         <DropdownMenuItem onClick={() => setEditingPolicy(policy)}>
                           <Pencil className="h-4 w-4 mr-2" />
                           Edit
                         </DropdownMenuItem>
                         <DropdownMenuItem 
                           className="text-red-600"
                           onClick={() => {
                             if (confirm('Delete this insurance policy?')) {
                               deletePolicy.mutate(policy.id);
                             }
                           }}
                         >
                           <Trash2 className="h-4 w-4 mr-2" />
                           Delete
                         </DropdownMenuItem>
                       </DropdownMenuContent>
                     </DropdownMenu>
                   </div>
                 </CardContent>
               </Card>
             );
           })}
         </div>
       )}
 
       {/* Dialogs */}
       <AddInsuranceDialog
         open={showAddDialog}
         onOpenChange={setShowAddDialog}
         propertyId={propertyId}
       />
 
       {editingPolicy && (
         <EditInsuranceDialog
           open={!!editingPolicy}
           onOpenChange={() => setEditingPolicy(null)}
           policy={editingPolicy}
         />
       )}
     </div>
   );
 }