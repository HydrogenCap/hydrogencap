import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';

import { ArrowLeft, Mail, Phone, User, Building2, Calendar, Briefcase, Shield, Home, PoundSterling, Edit, FileText, Users, Upload, ExternalLink, Download, Send, Loader2, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { supabase } from '@/integrations/supabase/client';
 import { Button } from '@/components/ui/button';
 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useTenant, TenantStatus } from '@/hooks/useTenants';
import { useTenancies } from '@/hooks/useTenancies';
import { LoadingState } from '@/components/common';
import { TenancyComplianceChecklist } from '@/components/tenants/TenancyComplianceChecklist';
import CreateTenancyDialog from '@/components/tenants/CreateTenancyDialog';
import { useQuery, useQueryClient } from '@tanstack/react-query';
 
const statusConfig: Record<TenantStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
   prospect: { label: 'Prospect', variant: 'outline' },
   active: { label: 'Active', variant: 'default' },
   past: { label: 'Past', variant: 'secondary' },
   blacklisted: { label: 'Blacklisted', variant: 'destructive' },
 };
 
 export default function TenantDetail() {
    const { tenantId } = useParams<{ tenantId: string }>();
    const queryClient = useQueryClient();
    const [showTenancyDialog, setShowTenancyDialog] = useState(false);
    const [sendingCerts, setSendingCerts] = useState(false);
    const [certsSent, setCertsSent] = useState(false);
    const { toast } = useToast();

    const { data: tenant, isLoading: tenantLoading } = useTenant(tenantId!);
    const { data: tenancies, isLoading: tenanciesLoading } = useTenancies({ tenantId });

    // Fetch documents linked to this tenant or their tenancies
    const tenancyIds = tenancies?.map(t => t.id) || [];
    const { data: tenantDocuments } = useQuery({
      queryKey: ['tenant-documents', tenantId, tenancyIds],
      queryFn: async () => {
        // Get documents by tenant_id OR tenancy_id
        let allDocs: any[] = [];
        
        // Docs linked directly to tenant
        const { data: byTenant } = await supabase
          .from('documents')
          .select('*')
          .eq('tenant_id', tenantId!)
          .is('deleted_at', null)
          .order('created_at', { ascending: false });
        if (byTenant) allDocs.push(...byTenant);

        // Docs linked to tenancies
        if (tenancyIds.length > 0) {
          const { data: byTenancy } = await supabase
            .from('documents')
            .select('*')
            .in('tenancy_id', tenancyIds)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });
          if (byTenancy) allDocs.push(...byTenancy);
        }

        // Also include tenancy agreements stored as URLs on the tenancy record
        const agreementDocs = tenancies
          ?.filter(t => t.tenancy_agreement_url)
          .map(t => ({
            id: `agreement-${t.id}`,
            original_file_name: `Tenancy Agreement - ${t.property.address_line}`,
            file_url: t.tenancy_agreement_url,
            created_at: t.start_date,
            doc_type: 'tenancy_agreement',
            category: 'tenancy',
            _isAgreementUrl: true,
          })) || [];

        // Deduplicate by id
        const docMap = new Map(allDocs.map(d => [d.id, d]));
        agreementDocs.forEach(a => { if (!docMap.has(a.id)) docMap.set(a.id, a); });
        
        return Array.from(docMap.values());
      },
      enabled: !!tenantId && !tenanciesLoading,
    });
 
  if (tenantLoading || tenanciesLoading) return <AppLayout><LoadingState text="Loading tenant..." /></AppLayout>;
   if (!tenant) return <AppLayout><div className="p-6">Tenant not found</div></AppLayout>;
 
   const activeTenancy = tenancies?.find(t => t.status === 'active');
   const status = statusConfig[tenant.status];
   const isCompany = tenant.tenant_type === 'company';
    const displayName = isCompany
      ? (tenant.company_name || `${tenant.first_name} ${tenant.last_name}`)
      : `${tenant.first_name} ${tenant.last_name}`;

    const handleSendCertificates = async () => {
      if (!activeTenancy) {
        toast({ title: 'No active tenancy', description: 'Cannot send certificates without an active tenancy.', variant: 'destructive' });
        return;
      }
      const recipientEmail = isCompany
        ? (tenant.company_contact_email || tenant.email)
        : tenant.email;
      if (!recipientEmail) {
        toast({ title: 'No email address', description: 'This tenant has no email address on file.', variant: 'destructive' });
        return;
      }

      setSendingCerts(true);
      setCertsSent(false);
      try {
        const { data, error } = await supabase.functions.invoke('send-tenant-certificates', {
          body: {
            tenantId: tenant.id,
            tenancyId: activeTenancy.id,
            propertyId: activeTenancy.property.id,
            complianceTypes: ['EPC', 'Gas Safety Certificate (CP12)'],
          },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        setCertsSent(true);
        toast({ title: 'Certificates sent', description: `EPC & Gas Safety emailed to ${data.sentTo}` });
        queryClient.invalidateQueries({ queryKey: ['tenant-documents'] });
      } catch (err: any) {
        toast({ title: 'Failed to send', description: err.message, variant: 'destructive' });
      } finally {
        setSendingCerts(false);
      }
    };
 
   return (
     <AppLayout>
       <div className="space-y-6 p-4 lg:p-6">
         {/* Header */}
         <div className="flex items-center gap-4">
           <Button variant="ghost" size="icon" asChild>
             <Link to="/tenants">
               <ArrowLeft className="h-5 w-5" />
             </Link>
           </Button>
           <div className="flex-1">
             <div className="flex items-center gap-3">
               {isCompany ? <Building2 className="h-5 w-5 text-muted-foreground" /> : <User className="h-5 w-5 text-muted-foreground" />}
               <h1 className="text-2xl font-bold">
                 {displayName}
               </h1>
               <Badge variant={status.variant}>{status.label}</Badge>
               {isCompany && tenant.company_number && (
                 <Badge variant="outline" className="text-xs">{tenant.company_number}</Badge>
               )}
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
             {isCompany ? (
               <>
                 {/* Company Details Card */}
                 <Card>
                   <CardHeader>
                     <CardTitle className="text-lg flex items-center gap-2">
                       <Building2 className="h-5 w-5" />
                       Company Details
                     </CardTitle>
                   </CardHeader>
                   <CardContent className="space-y-3 text-sm">
                     <div>
                       <span className="text-muted-foreground">Name:</span>{' '}
                       <span className="font-medium">{tenant.company_name}</span>
                     </div>
                     {tenant.company_number && (
                       <div>
                         <span className="text-muted-foreground">Number:</span> {tenant.company_number}
                       </div>
                     )}
                     {tenant.company_registered_address && (
                       <div>
                         <span className="text-muted-foreground">Registered Address:</span> {tenant.company_registered_address}
                       </div>
                     )}
                     {tenant.trading_name && (
                       <div>
                         <span className="text-muted-foreground">Trading As:</span> {tenant.trading_name}
                       </div>
                     )}
                     {tenant.vat_registered && (
                       <div>
                         <span className="text-muted-foreground">VAT:</span> {tenant.vat_number || 'Registered'}
                       </div>
                     )}
                   </CardContent>
                 </Card>

                 {/* Contact Details Card */}
                 <Card>
                   <CardHeader>
                     <CardTitle className="text-lg flex items-center gap-2">
                       <Users className="h-5 w-5" />
                       Contact Details
                     </CardTitle>
                   </CardHeader>
                   <CardContent className="space-y-3 text-sm">
                     {tenant.company_contact_name && (
                       <div>
                         <span className="font-medium">{tenant.company_contact_name}</span>
                         {tenant.company_contact_role && (
                           <span className="text-muted-foreground"> ({tenant.company_contact_role})</span>
                         )}
                       </div>
                     )}
                     {(tenant.company_contact_email || tenant.email) && (
                       <div className="flex items-center gap-2">
                         <Mail className="h-4 w-4 text-muted-foreground" />
                         <a href={`mailto:${tenant.company_contact_email || tenant.email}`} className="text-primary hover:underline">
                           {tenant.company_contact_email || tenant.email}
                         </a>
                       </div>
                     )}
                     {(tenant.company_contact_phone || tenant.phone) && (
                       <div className="flex items-center gap-2">
                         <Phone className="h-4 w-4 text-muted-foreground" />
                         <a href={`tel:${tenant.company_contact_phone || tenant.phone}`} className="hover:underline">
                           {tenant.company_contact_phone || tenant.phone}
                         </a>
                       </div>
                     )}
                   </CardContent>
                 </Card>
               </>
             ) : (
               <>
                 {/* Individual Contact */}
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
               </>
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
                       <div key={tenancy.id} className="space-y-3">
                         <Card>
                           <CardContent className="p-4">
                             <div className="flex justify-between items-start">
                               <div>
                                 <div className="flex items-center gap-2 mb-1">
                                    <Home className="h-4 w-4" />
                                    <span className="font-medium">{tenancy.room.room_name === 'Whole Property' ? tenancy.property.address_line : tenancy.room.room_name}</span>
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
                                   {(tenancy as any).payment_method && (
                                     <Badge variant="outline" className="mt-1 text-[10px]">
                                       {(tenancy as any).payment_method.replace('_', ' ')}
                                     </Badge>
                                   )}
                                   <div className="flex gap-1 mt-2 justify-end">
                                     {tenancy.tenancy_agreement_url ? (
                                       <Button variant="outline" size="sm" asChild>
                                         <a href={tenancy.tenancy_agreement_url} target="_blank" rel="noopener noreferrer">
                                           <FileText className="h-3 w-3 mr-1" />
                                           View Agreement
                                         </a>
                                       </Button>
                                     ) : (
                                       <Button variant="outline" size="sm" className="text-amber-600">
                                         <Upload className="h-3 w-3 mr-1" />
                                         Upload Agreement
                                       </Button>
                                     )}
                                   </div>
                                 </div>
                              </div>
                            </CardContent>
                          </Card>
                         {(tenancy.status === 'active' || tenancy.status === 'pending') && (
                           <TenancyComplianceChecklist
                             tenancyId={tenancy.id}
                             tenantType={tenant.tenant_type as 'individual' | 'company'}
                           />
                         )}
                       </div>
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
 
                <TabsContent value="documents" className="mt-4 space-y-4">
                  {activeTenancy && (
                    <Card>
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <p className="font-medium">Send Compliance Certificates</p>
                          <p className="text-sm text-muted-foreground">
                            Email EPC & Gas Safety certificates to {isCompany ? (tenant.company_contact_email || tenant.email) : tenant.email}
                          </p>
                        </div>
                        <Button
                          onClick={handleSendCertificates}
                          disabled={sendingCerts}
                          variant={certsSent ? 'outline' : 'default'}
                        >
                          {sendingCerts ? (
                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending...</>
                          ) : certsSent ? (
                            <><CheckCircle2 className="h-4 w-4 mr-2" />Sent</>
                          ) : (
                            <><Send className="h-4 w-4 mr-2" />Send Certificates</>
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  )}

                  {!tenantDocuments || tenantDocuments.length === 0 ? (
                    <Card>
                      <CardContent className="py-8 text-center text-muted-foreground">
                        <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        No documents yet
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-2">
                      {tenantDocuments.map((doc: any) => (
                        <Card key={doc.id}>
                          <CardContent className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3 min-w-0">
                              <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                              <div className="min-w-0">
                                <p className="font-medium truncate">{doc.display_name || doc.original_file_name}</p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  {doc.doc_type && <Badge variant="outline" className="text-[10px]">{doc.doc_type}</Badge>}
                                  {doc.created_at && <span>{format(new Date(doc.created_at), 'dd MMM yyyy')}</span>}
                                </div>
                              </div>
                            </div>
                            <Button variant="outline" size="sm" asChild>
                              <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-3 w-3 mr-1" />
                                View
                              </a>
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>
             </Tabs>
           </div>
         </div>
 
          <CreateTenancyDialog
            open={showTenancyDialog}
            onOpenChange={setShowTenancyDialog}
            tenantId={tenant.id}
            tenantName={isCompany ? (tenant.company_name || `${tenant.first_name} ${tenant.last_name}`) : `${tenant.first_name} ${tenant.last_name}`}
            tenantType={(tenant.tenant_type as 'individual' | 'company') || 'individual'}
          />
        </div>
     </AppLayout>
   );
 }
