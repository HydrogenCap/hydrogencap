 import React, { useState } from 'react';
 import { Plus, Search, Star, Briefcase, Filter, HardHat } from 'lucide-react';
 import { AppLayout } from '@/components/layout/AppLayout';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Card, CardContent } from '@/components/ui/card';
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
 import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
 import { useContractors } from '@/hooks/useContractors';
 import { COMPLIANCE_TYPES } from '@/lib/schemas/compliance';
 import { ContractorCard, AddContractorDialog } from '@/components/contractors';
 import { JobTrackerWidget } from '@/components/contractors/JobTrackerWidget';
 
 export default function Contractors() {
   const [searchTerm, setSearchTerm] = useState('');
   const [complianceFilter, setComplianceFilter] = useState<string>('all');
   const [showAddDialog, setShowAddDialog] = useState(false);
 
   const { data: contractors, isLoading } = useContractors({
     isActive: true,
     complianceType: complianceFilter !== 'all' ? complianceFilter : undefined,
   });
 
   const filteredContractors = contractors?.filter(c =>
     c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
     c.company_name?.toLowerCase().includes(searchTerm.toLowerCase())
   );
 
   const preferredContractors = filteredContractors?.filter(c => c.is_preferred) || [];
   const otherContractors = filteredContractors?.filter(c => !c.is_preferred) || [];
 
   return (
     <AppLayout>
       <div className="space-y-6">
         {/* Header */}
         <div className="flex items-center justify-between">
           <div>
             <h1 className="text-2xl font-bold">Contractor Directory</h1>
             <p className="text-muted-foreground">Manage your trusted contractors and service providers</p>
           </div>
           <Button onClick={() => setShowAddDialog(true)}>
             <Plus className="h-4 w-4 mr-2" />
             Add Contractor
           </Button>
         </div>
 
         <div className="grid gap-6 lg:grid-cols-3">
           {/* Main content */}
           <div className="lg:col-span-2 space-y-4">
             {/* Filters */}
             <div className="flex items-center gap-4">
               <div className="relative flex-1">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                 <Input
                   placeholder="Search contractors..."
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
                   className="pl-10"
                 />
               </div>
               <Select value={complianceFilter} onValueChange={setComplianceFilter}>
                 <SelectTrigger className="w-64">
                   <Filter className="h-4 w-4 mr-2" />
                   <SelectValue placeholder="Filter by service" />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="all">All Services</SelectItem>
                   {COMPLIANCE_TYPES.map(type => (
                     <SelectItem key={type} value={type}>{type}</SelectItem>
                   ))}
                 </SelectContent>
               </Select>
             </div>
 
             {/* Contractors Grid */}
             {isLoading ? (
               <div className="grid gap-4 md:grid-cols-2">
                 {[1, 2, 3, 4].map(i => (
                   <Card key={i} className="h-48 animate-pulse bg-muted" />
                 ))}
               </div>
             ) : (
               <Tabs defaultValue="all">
                 <TabsList>
                   <TabsTrigger value="all">All ({filteredContractors?.length || 0})</TabsTrigger>
                   <TabsTrigger value="preferred">
                     <Star className="h-4 w-4 mr-1 fill-amber-400 text-amber-400" />
                     Preferred ({preferredContractors.length})
                   </TabsTrigger>
                 </TabsList>
 
                 <TabsContent value="all" className="mt-4">
                   {preferredContractors.length > 0 && (
                     <div className="mb-6">
                       <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                         <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                         Preferred Contractors
                       </h3>
                       <div className="grid gap-4 md:grid-cols-2">
                         {preferredContractors.map(contractor => (
                           <ContractorCard key={contractor.id} contractor={contractor} />
                         ))}
                       </div>
                     </div>
                   )}
 
                   {otherContractors.length > 0 && (
                     <div>
                       {preferredContractors.length > 0 && (
                         <h3 className="text-sm font-medium text-muted-foreground mb-3">Other Contractors</h3>
                       )}
                       <div className="grid gap-4 md:grid-cols-2">
                         {otherContractors.map(contractor => (
                           <ContractorCard key={contractor.id} contractor={contractor} />
                         ))}
                       </div>
                     </div>
                   )}
 
                   {filteredContractors?.length === 0 && (
                     <Card>
                       <CardContent className="py-12 text-center">
                         <HardHat className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                         <h3 className="font-medium mb-1">No contractors found</h3>
                         <p className="text-sm text-muted-foreground mb-4">
                           {searchTerm || complianceFilter !== 'all'
                             ? 'Try adjusting your filters'
                             : 'Add your first contractor to get started'}
                         </p>
                         <Button onClick={() => setShowAddDialog(true)}>
                           <Plus className="h-4 w-4 mr-2" />
                           Add Contractor
                         </Button>
                       </CardContent>
                     </Card>
                   )}
                 </TabsContent>
 
                 <TabsContent value="preferred" className="mt-4">
                   <div className="grid gap-4 md:grid-cols-2">
                     {preferredContractors.map(contractor => (
                       <ContractorCard key={contractor.id} contractor={contractor} />
                     ))}
                   </div>
                   {preferredContractors.length === 0 && (
                     <Card>
                       <CardContent className="py-12 text-center">
                         <Star className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                         <h3 className="font-medium mb-1">No preferred contractors</h3>
                         <p className="text-sm text-muted-foreground">
                           Mark contractors as preferred to see them here
                         </p>
                       </CardContent>
                     </Card>
                   )}
                 </TabsContent>
               </Tabs>
             )}
           </div>
 
           {/* Sidebar - Active Jobs */}
           <div>
             <JobTrackerWidget />
           </div>
         </div>
       </div>
 
       <AddContractorDialog
         open={showAddDialog}
         onOpenChange={setShowAddDialog}
       />
     </AppLayout>
   );
 }