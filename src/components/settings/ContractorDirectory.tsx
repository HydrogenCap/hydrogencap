 import React, { useState } from 'react';
 import { Plus, User, Phone, Mail, Globe, Trash2, Star, Edit2, Loader2 } from 'lucide-react';
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Label } from '@/components/ui/label';
 import { Textarea } from '@/components/ui/textarea';
 import { Badge } from '@/components/ui/badge';
 import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
 import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
 import { useContractors, useCreateContractor, useUpdateContractor, useDeleteContractor, Contractor } from '@/hooks/useContractors';
 import { COMPLIANCE_TYPES } from '@/lib/schemas/compliance';
 
 const COMPLIANCE_TYPE_OPTIONS = COMPLIANCE_TYPES.map(t => ({ value: t, label: t }));
 type ContractorCreateInput = Omit<Contractor, 'id' | 'org_id' | 'average_rating' | 'total_jobs' | 'last_used_at'>;
 type ContractorFormData = Pick<
   ContractorCreateInput,
   'name' | 'company_name' | 'email' | 'phone' | 'website' | 'compliance_types' | 'notes' | 'is_preferred'
 >;
 
 export function ContractorDirectory() {
   const { data: contractors, isLoading } = useContractors();
   const createContractor = useCreateContractor();
   const updateContractor = useUpdateContractor();
   const deleteContractor = useDeleteContractor();
   
   const [dialogOpen, setDialogOpen] = useState(false);
   const [editingContractor, setEditingContractor] = useState<Contractor | null>(null);
   const [formData, setFormData] = useState<ContractorFormData>({
     name: '',
     company_name: '',
     email: '',
     phone: '',
     website: '',
     compliance_types: [] as string[],
     notes: '',
     is_preferred: false,
   });
 
   const resetForm = () => {
     setFormData({
       name: '',
       company_name: '',
       email: '',
       phone: '',
       website: '',
       compliance_types: [],
       notes: '',
       is_preferred: false,
     });
     setEditingContractor(null);
   };
 
   const handleEdit = (contractor: Contractor) => {
     setEditingContractor(contractor);
     setFormData({
       name: contractor.name,
       company_name: contractor.company_name || '',
       email: contractor.email || '',
       phone: contractor.phone || '',
       website: contractor.website || '',
       compliance_types: contractor.compliance_types || [],
       notes: contractor.notes || '',
       is_preferred: contractor.is_preferred,
     });
     setDialogOpen(true);
   };
 
   const handleSubmit = async () => {
     if (editingContractor) {
       await updateContractor.mutateAsync({ id: editingContractor.id, ...formData });
     } else {
       const contractorPayload: ContractorCreateInput = {
         ...formData,
         is_active: true,
         service_areas: null,
         avg_response_hours: null,
         hourly_rate_gbp: null,
         call_out_fee_gbp: null,
         typical_costs: {},
         availability_notes: null,
       };
       await createContractor.mutateAsync(contractorPayload);
     }
     setDialogOpen(false);
     resetForm();
   };
 
   const toggleComplianceType = (type: string) => {
     setFormData(prev => ({
       ...prev,
       compliance_types: prev.compliance_types.includes(type)
         ? prev.compliance_types.filter(t => t !== type)
         : [...prev.compliance_types, type],
     }));
   };
 
   if (isLoading) {
     return (
       <div className="flex items-center justify-center p-8">
         <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
       </div>
     );
   }
 
   return (
     <div className="space-y-6">
       <Card>
         <CardHeader className="flex flex-row items-center justify-between space-y-0">
           <div>
             <CardTitle className="flex items-center gap-2">
               <User className="h-5 w-5" />
               Contractor Directory
             </CardTitle>
             <CardDescription>
               Store preferred contractors for compliance renewals.
             </CardDescription>
           </div>
           <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
             <DialogTrigger asChild>
               <Button>
                 <Plus className="h-4 w-4 mr-2" />
                 Add Contractor
               </Button>
             </DialogTrigger>
             <DialogContent className="max-w-lg">
               <DialogHeader>
                 <DialogTitle>{editingContractor ? 'Edit Contractor' : 'Add Contractor'}</DialogTitle>
                 <DialogDescription>
                   Store contact details for compliance service providers.
                 </DialogDescription>
               </DialogHeader>
               <div className="space-y-4 py-4">
                 <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                     <Label>Contact Name *</Label>
                     <Input
                       value={formData.name}
                       onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                       placeholder="John Smith"
                     />
                   </div>
                   <div className="space-y-2">
                     <Label>Company Name</Label>
                     <Input
                       value={formData.company_name}
                       onChange={(e) => setFormData(prev => ({ ...prev, company_name: e.target.value }))}
                       placeholder="ABC Gas Services"
                     />
                   </div>
                 </div>
 
                 <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                     <Label>Email</Label>
                     <Input
                       type="email"
                       value={formData.email}
                       onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                       placeholder="john@example.com"
                     />
                   </div>
                   <div className="space-y-2">
                     <Label>Phone</Label>
                     <Input
                       value={formData.phone}
                       onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                       placeholder="07123 456789"
                     />
                   </div>
                 </div>
 
                 <div className="space-y-2">
                   <Label>Website</Label>
                   <Input
                     value={formData.website}
                     onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
                     placeholder="https://www.example.com"
                   />
                 </div>
 
                 <div className="space-y-2">
                   <Label>Compliance Types</Label>
                   <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border rounded-md">
                     {COMPLIANCE_TYPE_OPTIONS.map(opt => (
                       <Badge
                         key={opt.value}
                         variant={formData.compliance_types.includes(opt.value) ? 'default' : 'outline'}
                         className="cursor-pointer text-xs"
                         onClick={() => toggleComplianceType(opt.value)}
                       >
                         {opt.label}
                       </Badge>
                     ))}
                   </div>
                 </div>
 
                 <div className="space-y-2">
                   <Label>Notes</Label>
                   <Textarea
                     value={formData.notes}
                     onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                     placeholder="Any notes about this contractor..."
                     rows={2}
                   />
                 </div>
 
                 <div className="flex items-center gap-2">
                   <input
                     type="checkbox"
                     id="is_preferred"
                     checked={formData.is_preferred}
                     onChange={(e) => setFormData(prev => ({ ...prev, is_preferred: e.target.checked }))}
                     className="rounded border-border"
                   />
                   <Label htmlFor="is_preferred" className="cursor-pointer">Mark as preferred contractor</Label>
                 </div>
               </div>
               <DialogFooter>
                 <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                 <Button 
                   onClick={handleSubmit} 
                   disabled={!formData.name || createContractor.isPending || updateContractor.isPending}
                 >
                   {(createContractor.isPending || updateContractor.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                   {editingContractor ? 'Save Changes' : 'Add Contractor'}
                 </Button>
               </DialogFooter>
             </DialogContent>
           </Dialog>
         </CardHeader>
         <CardContent>
           {(!contractors || contractors.length === 0) ? (
             <div className="text-center py-8 text-muted-foreground">
               <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
               <p>No contractors added yet.</p>
               <p className="text-sm">Add your preferred compliance contractors to streamline renewals.</p>
             </div>
           ) : (
             <div className="space-y-3">
               {contractors.map(contractor => (
                 <div 
                   key={contractor.id} 
                   className="flex items-start justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                 >
                   <div className="space-y-1">
                     <div className="flex items-center gap-2">
                       <span className="font-medium">{contractor.name}</span>
                       {contractor.is_preferred && (
                         <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                       )}
                       {contractor.company_name && (
                         <span className="text-sm text-muted-foreground">({contractor.company_name})</span>
                       )}
                     </div>
                     <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                       {contractor.phone && (
                         <span className="flex items-center gap-1">
                           <Phone className="h-3 w-3" /> {contractor.phone}
                         </span>
                       )}
                       {contractor.email && (
                         <span className="flex items-center gap-1">
                           <Mail className="h-3 w-3" /> {contractor.email}
                         </span>
                       )}
                       {contractor.website && (
                         <a href={contractor.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                           <Globe className="h-3 w-3" /> Website
                         </a>
                       )}
                     </div>
                     {contractor.compliance_types.length > 0 && (
                       <div className="flex flex-wrap gap-1 mt-2">
                         {contractor.compliance_types.slice(0, 3).map(type => (
                           <Badge key={type} variant="secondary" className="text-xs">{type}</Badge>
                         ))}
                         {contractor.compliance_types.length > 3 && (
                           <Badge variant="secondary" className="text-xs">+{contractor.compliance_types.length - 3} more</Badge>
                         )}
                       </div>
                     )}
                   </div>
                   <div className="flex items-center gap-1">
                     <Button aria-label="Edit" variant="ghost" size="icon" onClick={() => handleEdit(contractor)}>
                       <Edit2 className="h-4 w-4" />
                     </Button>
                     <AlertDialog>
                       <AlertDialogTrigger asChild>
                   <Button aria-label="Delete" variant="ghost" size="icon">
                           <Trash2 className="h-4 w-4" />
                         </Button>
                       </AlertDialogTrigger>
                       <AlertDialogContent>
                         <AlertDialogHeader>
                           <AlertDialogTitle>Delete Contractor</AlertDialogTitle>
                           <AlertDialogDescription>
                             Are you sure you want to remove {contractor.name} from your contractor directory?
                           </AlertDialogDescription>
                         </AlertDialogHeader>
                         <AlertDialogFooter>
                           <AlertDialogCancel>Cancel</AlertDialogCancel>
                           <AlertDialogAction onClick={() => deleteContractor.mutate(contractor.id)}>Delete</AlertDialogAction>
                         </AlertDialogFooter>
                       </AlertDialogContent>
                     </AlertDialog>
                   </div>
                 </div>
               ))}
             </div>
           )}
         </CardContent>
       </Card>
     </div>
   );
 }
